import React from "react";
import {Container, Message} from "semantic-ui-react"
import {getConsensualPrivateKey, getGraffitiWallet, numberToFeedIndex} from "../Utils.js";
import {Bee, Utils} from "@ethersphere/bee-js";
import sha256 from "crypto-js/sha256.js";

export default class ChatStream extends React.Component {
    bee = {}
    graffitiSignerPk = ''
    graffitiFeedWallet = ''
    graffitiSigner = {}
    consensusHash = ''
    feedReader = {}
    readInterval = 1000
    lastReadIndex = -1
    allowRead = false

    constructor(props) {
        super(props);

        const {chats, chatIndex} = this.getChatData(this.props.hash);
        if (chatIndex === -1) {
            this.navigate('/chat');
            return
        }

        const roomData = chats[chatIndex];
        let messages = JSON.parse(localStorage.getItem('messages') || '{}');
        const roomMessages = messages[this.props.hash];

        this.state = {
            hash: this.props.hash,
            messages: roomMessages || [],
            id: roomData.id || '',
            room: roomData.room || '',
            postageBatchID: roomData.postageBatchID || '',
        };

        this.lastReadIndex = parseInt(roomData.lastReadIndex || -1)

        this.readMessagesOnLoad = this.readMessagesOnLoad.bind(this)
        this.readNextMessage = this.readNextMessage.bind(this)
        this.saveMessages = this.saveMessages.bind(this)
        this.readNewMessage = this.readNewMessage.bind(this)
        this.readableStateChanged = this.readableStateChanged.bind(this)
    }

    navigate(path){
        window.location.href = path;
    }

    getChatData(hash) {
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        const chatIndex = chats.findIndex((chat) => {
            return chat.hash === hash
        });
        return {chats, chatIndex};
    }

    async componentDidMount() {
        window.addEventListener('readableStateChanged', this.readableStateChanged);
        this.setupFeedSettings();
        this.readMessagesOnLoad();
    }

    readableStateChanged(event) {
        console.log("readableStateChanged", event)
        this.allowRead = event.detail.allowRead
    }

    setupFeedSettings() {
        this.bee = new Bee('http://localhost:1633')
        this.graffitiSignerPk = getConsensualPrivateKey(this.state.room)
        this.graffitiFeedWallet = getGraffitiWallet(this.graffitiSignerPk);

        this.graffitiSigner = {
            address: Utils.hexToBytes(this.graffitiFeedWallet.address.slice(2)), // convert hex string to Uint8Array
            sign: async (data) => {
                return await this.graffitiFeedWallet.signMessage(data)
            },
        }

        this.consensusHash = Utils.keccak256Hash(this.state.id)
        this.feedReader = this.bee.makeFeedReader('sequence', this.consensusHash, this.graffitiSigner.address)
    }

    async readMessageToIndex(index) {
        let opts = null
        if (index > -1) {
            opts = {index: numberToFeedIndex(index)}
            console.log("read message with index: ", index, opts);
        }
        try {
            console.log("read message with index: " + index);
            const recordPointer = await this.feedReader.download(opts)
            const data = await this.bee.downloadData(recordPointer.reference)
            return JSON.parse(new TextDecoder().decode(data))
        } catch (e) {
        }
    }

    async getFeedActualUpdateIndex() {
        const feedUpdate = await this.feedReader.download()
        return parseInt(feedUpdate.feedIndex, 16)
    }

    async isFeedRetrievable() {
        let isRetrievable = false;
        try {
            isRetrievable = await this.bee.isFeedRetrievable("sequence", this.graffitiSigner.address, this.consensusHash)
        } catch (e) {
            isRetrievable = false;
        }

        return isRetrievable;
    }

    async readNextMessage() {
        console.log("processing message with index: " + (this.lastReadIndex + 1));
        const message = await this.readMessageToIndex(this.lastReadIndex + 1)
        console.log("message received", message)

        this.setState({
            messages: [...this.state.messages, message],
        }, this.saveMessages)
        this.lastReadIndex++;
    }

    async readMessagesOnLoad() {
        console.log("called readMessagesOnLoad")

        if (this.allowRead === false) {
            console.log("read is not allowed for some reason")
            setTimeout(this.readMessagesOnLoad, 1000)
            return
        }

        const isFeedRetrievable = await this.isFeedRetrievable()
        if (!isFeedRetrievable) {
            console.log("feed is not retrievable")
            setTimeout(this.readMessagesOnLoad, 1000)
            return;
        }

        console.log("feed is retrievable")

        const feedIndex = await this.getFeedActualUpdateIndex()
        console.log(feedIndex, this.lastReadIndex)
        while (feedIndex > this.lastReadIndex) {
            await this.readNextMessage()
            this.saveMessages()
        }

        setTimeout(this.readNewMessage, this.readInterval);
    }

    saveMessages() {
        console.log("saving messages")
        let messages = JSON.parse(localStorage.getItem('messages') || '{}');
        messages[this.state.hash] = this.state.messages;
        localStorage.setItem('messages', JSON.stringify(messages));
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        const chatIndex = chats.findIndex((chat) => chat.hash === this.state.hash);
        if (chatIndex > -1) {
            chats[chatIndex].lastReadIndex = this.lastReadIndex;
            localStorage.setItem('chats', JSON.stringify(chats));
        }
        console.log("messages saved")
    }

    async readNewMessage(){
        console.log("checking for new messages")
        if (this.allowRead === false) {
            console.log("read is not allowed for some reason")
            return
        }
        const feedIndex = await this.getFeedActualUpdateIndex()
        if (feedIndex > this.lastReadIndex) {
            await this.readNextMessage()
        }

        setTimeout(this.readNewMessage, this.readInterval);
    }

    render() {
        return (
            <Container key={sha256(JSON.stringify(this.state.messages))} style={{
                "display": "flex",
                "flexDirection": "column-reverse",
                "alignItems": "stretch",
                "position": "relative",
                "float": "left",
                "width": "60%",
                "height": "400px",
                "overflowY": "scroll",
            }}>
                <Container style={{"backgroundColor": "lightgray", "flexGrow": "1"}}>
                    {this.state.messages.map((message, index) => {
                        return (<Message size='mini' key={message.timestamp + ":" + index}>{message.text}</Message>)
                    })}
                </Container>
            </Container>
        );
    }
}