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
            existing: false,
        };

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.clearHistory = this.clearHistory.bind(this);
    }

    componentDidMount() {
        window.dispatchEvent(new CustomEvent('readableStateChanged', {detail: {allowRead: false}}));
        this.setChatExisting()
    }

    setChatExisting() {
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        const chatIndex = this.getRoomIndex();

        if (chatIndex > -1) {
            const chatRoom = chats[chatIndex];
            console.log(chatRoom)
            this.setState({existing: chatRoom.existing});
            return
        }

        this.setState({existing: false});
    }

    getRoomIndex(){
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        if (this.state.id === '' || this.state.room === '') {
            return -1;
        }

        let chatHash = sha256(this.state.id + this.state.room).toString();

        return chats.findIndex((chat) => chat.hash === chatHash);
    }

    async handleSubmit() {
        this.setState({loading: true});

        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        let chatHash = sha256(this.state.id + this.state.room).toString();
        const chatIndex = this.getRoomIndex();
        if (chatIndex > -1) {
            chats[chatIndex].postageBatchID = this.state.postageBatchID;
            console.log(chats[chatIndex])

            if(!chats[chatIndex].existing) {
                chats[chatIndex].existing = await this.createChatRoomIfNotExist()
            }

            localStorage.setItem('chats', JSON.stringify(chats));
            this.setState({loading: false, existing: true});

            sleep(5000)

            localStorage.setItem('chats', JSON.stringify(chats));
            this.navigate('/chatroom/' + chatHash);
            return;
        }

        const succeeded = await this.createChatRoomIfNotExist()
        if(!succeeded) {
            this.setState({message: 'Could not create chat room', loading: false});
            return;
        }

        chats.push({
            id: this.state.id,
            room: this.state.room,
            postageBatchID: this.state.postageBatchID,
            hash: chatHash,
            existing: succeeded,
        });
        localStorage.setItem('chats', JSON.stringify(chats));


        this.setState({loading: false, existing: succeeded});
        if (succeeded) {
            this.navigate('/chatroom/' + chatHash);
        }
    }

    async createChatRoomIfNotExist() {
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
        }catch (Error) {
            console.log("feed does not exist")
        }

        console.log("chat room exist,no need to reinitialize",isRetrievable)
        if (isRetrievable){
            return true
        }

        const manifestResult = await bee.createFeedManifest(this.state.postageBatchID, "sequence", consensusHash, graffitiSigner.address)
        console.log("createFeedManifest result", manifestResult.reference)
        sleep(2000)

        const data = {text: 'Welcome to the chat!', timestamp: Date.now()}
        const feedWriter = bee.makeFeedWriter('sequence', consensusHash, graffitiSigner)
        try {
            const beeUploadRef = await bee.uploadData(this.state.postageBatchID, serializeGraffitiRecord(data))
            console.log("bee.uploadData result", beeUploadRef.reference)
            const feedUploadRef = await feedWriter.upload(this.state.postageBatchID, beeUploadRef.reference)
            console.log("feedWriter.upload result", feedUploadRef)

            return true
        } catch (e) {
            return false
        }
    }

    navigate(path) {
        window.location.href = path;
    }

    _log() {
        console.log(localStorage.getItem('chats'));
    }

    handleInputChange(e) {
        localStorage.setItem('latest'+Strings.capitalize(e.target.name), e.target.value);
        this.setState({[e.target.name]: e.target.value},this.setChatExisting)
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
            <Form onSubmit={this.handleSubmit} loading={this.state.loading}>
                <FormInput onChange={this.handleInputChange} value={this.state.id} label="Consensus ID" name="id"
                           type='text' placeholder="The unique identifier for the chat app" disabled={this.state.loading} required/>
                <FormInput onChange={this.handleInputChange} value={this.state.room} label="Room's name" name="room"
                           type='text' placeholder="MyChatRoom..." disabled={this.state.loading} required/>
                <FormInput onChange={this.handleInputChange} value={this.state.postageBatchID} label="Postage Batch ID"
                           name="postageBatchID" type="password" disabled={this.state.loading} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"/>
                <Button loading={this.state.loading} type='submit' primary disabled={this.state.loading}>{this.state.existing ? 'Join Chat' : 'Create and Join chat'}</Button>
                <Button loading={this.state.loading} type='button' secondary onClick={this.clearHistory} disabled={this.state.loading}>Clear saved data</Button>
            </Form>
        </div>
    }
}

export default ChatPage;