import React from "react";
import {Button, Form, FormInput, Header, Message} from "semantic-ui-react"
import sha256 from 'crypto-js/sha256.js';
import {Strings} from "cafe-utility";
import {getConsensualPrivateKey, getGraffitiWallet, serializeGraffitiRecord, sleep} from "../Utils";
import {Bee, Utils} from "@ethersphere/bee-js";


class ChatPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            id: localStorage.getItem('latestId') || '',
            room: localStorage.getItem('latestRoom') || '',
            postageBatchID: localStorage.getItem('latestPostageBatchID') || '',
            message: '',
        };

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.clearHistory = this.clearHistory.bind(this);
    }

    componentDidMount() {
        window.dispatchEvent(new CustomEvent('readableStateChanged', {detail: {allowRead: false}}));
    }

    async handleSubmit() {
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        let chatHash = sha256(this.state.id + this.state.room).toString();
        const chatIndex = chats.findIndex((chat) => chat.hash === chatHash);
        if (chatIndex > -1) {
            chats[chatIndex].postageBatchID = this.state.postageBatchID;
            localStorage.setItem('chats', JSON.stringify(chats));
            this.navigate('/chatroom/' + chatHash);
            return;
        }
        chats.push({
            id: this.state.id,
            room: this.state.room,
            postageBatchID: this.state.postageBatchID,
            hash: chatHash
        });
        localStorage.setItem('chats', JSON.stringify(chats));

        //await this.checkCreateChat()

        this.navigate('/chatroom/' + chatHash);
    }

    async checkCreateChat() {
        const bee = new Bee("http://localhost:1633");
        const privateKey = getConsensualPrivateKey(this.state.room)
        const wallet = getGraffitiWallet(privateKey);
        getConsensualPrivateKey(this.state.room)

        const graffitiSigner = {
            address: Utils.hexToBytes(wallet.address.slice(2)), // convert hex string to Uint8Array
            sign: async (data) => {
                return await wallet.signMessage(data)
            },
        }

        const consensusHash = Utils.keccak256Hash(this.state.id)
        let isRetrievable = false;
        try {
            isRetrievable = await bee.isFeedRetrievable("sequence", graffitiSigner.address, consensusHash)
        }catch (e) {

        }

        console.log("bee.isFeedRetrievable",isRetrievable)

        if (isRetrievable) {
            console.log("chat room exist,no need to reinitialize");
            return;
        }

        const manifestResult = await bee.createFeedManifest(this.state.postageBatchID, "sequence", consensusHash, graffitiSigner.address)
        console.log("createFeedManifest result", manifestResult.reference)
        sleep(2000)

        const data = {text: 'Chat room initialized. Welcome!', timestamp: Date.now()}
        const feedWriter = bee.makeFeedWriter('sequence', consensusHash, graffitiSigner)
        const beeUploadRef = await bee.uploadData(this.state.postageBatchID, serializeGraffitiRecord(data))
        console.log("bee.uploadData result", beeUploadRef.reference)
        sleep(2000)
        const feedUploadRef = await feedWriter.upload(this.state.postageBatchID, beeUploadRef.reference)
        console.log("feedWriter.upload result", feedUploadRef)
        sleep(2000)
    }

    navigate(path) {
        window.location.href = path;
    }

    _log() {
        console.log(localStorage.getItem('chats'));
    }

    handleInputChange(e) {
        localStorage.setItem('latest'+Strings.capitalize(e.target.name), e.target.value);
        this.setState({[e.target.name]: e.target.value})
    }

    clearHistory(e) {
        localStorage.removeItem('chats');
        localStorage.removeItem('messages');
        this.setState({'message': 'History cleared'});
        const $this = this;
        setTimeout(() => {
            $this.setState({'message': ''});
        }, 3000);
        this._log();
    }

    render() {
        return <div>
            <Header as='h3'>Chat Page</Header>
            <Header as='h4'>Enter room name and password if necessary</Header>
            {this.state.message !== '' ? <Message info>{this.state.message}</Message> : null}
            <Form onSubmit={this.handleSubmit}>
                <FormInput onChange={this.handleInputChange} value={this.state.id} label="Consensus ID" name="id"
                           type='text' placeholder="The unique identifier for the chat app" required/>
                <FormInput onChange={this.handleInputChange} value={this.state.room} label="Room's name" name="room"
                           type='text' placeholder="MyChatRoom..." required/>
                <FormInput onChange={this.handleInputChange} value={this.state.postageBatchID} label="Postage Batch ID"
                           name="postageBatchID" type='password' placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/>
                <Button type='submit'>Join chat</Button>
                <Button type='button' secondary onClick={this.clearHistory}>Clear saved data</Button>
            </Form>
        </div>
    }
}

export default ChatPage;