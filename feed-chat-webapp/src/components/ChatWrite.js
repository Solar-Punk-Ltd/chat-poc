import React from "react";
import {Button, Container, GridRow, Header, TextArea} from "semantic-ui-react"
import {Bee, Utils} from '@ethersphere/bee-js'
import {getConsensualPrivateKey, getGraffitiWallet, serializeGraffitiRecord} from '../Utils.js'

export default class ChatWrite extends React.Component {
    graffitiSignerPk = ''
    graffitiFeedWallet = ''
    graffitiSigner = {}
    consensusHash = ''
    feedWriter = {}
    roomData = {}
    bee = {}
    rules = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed porta malesuada metus quis tempor.',
        'Integer sed ligula elementum risus molestie lacinia sit amet eget justo.',
        'Fusce eu vestibulum lorem. Integer quis massa at est aliquet interdum vel ut nunc.',
        'Vivamus sapien eros, scelerisque et tellus quis, finibus hendrerit dui.',
        'Nulla vel ex ac tellus congue iaculis quis in nunc. Mauris eget massa vitae est placerat blandit.'
    ]

    constructor(props) {
        super(props);
        this.state = {
            message: '',
            hash: this.props.hash,
            room: '',
            id: '',
            postageBatchID: '',
            ready: false, //should start with false and rerender on succeeded retrieval
        };

        this.bee = new Bee('http://localhost:1633')

        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        const chatIndex = chats.findIndex((chat) => chat.hash === this.state.hash);
        if (chatIndex === -1) {
            this.navigate('/chat');
            return
        }
        this.roomData = chats[chatIndex];
        this.state.room = this.roomData.room
        this.state.id = this.roomData.id
        this.state.postageBatchID = this.roomData.postageBatchID;

        this.graffitiSignerPk = getConsensualPrivateKey(this.state.room)
        this.graffitiFeedWallet = getGraffitiWallet(this.graffitiSignerPk);

        this.graffitiSigner = {
            address: Utils.hexToBytes(this.graffitiFeedWallet.address.slice(2)), // convert hex string to Uint8Array
            sign: async (data) => {
                return await this.graffitiFeedWallet.signMessage(data)
            },
        }

        this.consensusHash = Utils.keccak256Hash(this.roomData.id)
    }

    async componentDidMount() {
        await this.initFeed()
    }

    async initFeed(){
        console.log("init feed")
        const {justCreated,successful} = await this.checkOrCreateFeed()

        console.log("checkOrCreateFeed",justCreated,successful)

        if (!successful){
            console.log("could not initFeed")
            window.dispatchEvent(new CustomEvent('readableStateChanged', {detail: {allowRead: false}}));
            return
        }

        this.feedWriter = this.bee.makeFeedWriter('sequence', this.consensusHash, this.graffitiSigner)
        if(justCreated){
            await this.uploadMessageToFeed("Welcome to the chat!")
        }

        const retrievable = await this.bee.isFeedRetrievable("sequence", this.graffitiSigner.address, this.consensusHash)
        this.setState({ready: retrievable})
    }

    async checkOrCreateFeed() {
        console.log("check existing feed or create one")
        const isRetrievable = await this.bee.isFeedRetrievable("sequence", this.graffitiSigner.address, this.consensusHash)

        if (isRetrievable) {
            console.log("feed does exist")
            return {justCreated: false,successful: true}
        }

        try {
            const manifestResult = await this.bee.createFeedManifest(this.state.postageBatchID, "sequence", this.consensusHash, this.graffitiSigner.address)
            console.log("created new feed", manifestResult)
            return {justCreated: true, successful: true}
        }catch (e) {
            console.log("could not create feed", e)
            return {justCreated: false,successful: false}
        }
    }

    handleInputChange = (event) => {
        this.setState({[event.target.name]: event.target.value});
    }

    async uploadMessageToBee(message) {
        const data = {text: message, timestamp: Date.now()}

        return await this.bee.uploadData(this.state.postageBatchID, serializeGraffitiRecord(data))
    }

    async uploadMessageToFeed(message) {
        const reference = await this.uploadMessageToBee(message)
        console.log("uploaded message: " + message, "reference: " + reference.reference)

        return await this.feedWriter.upload(this.state.postageBatchID, reference.reference)
    }

    handleSubmit = async (event) => {
        if (this.state.ready === false) {
            window.alert("Feed not ready yet")
            return
        }
        if (this.state.message.trim() === '') {
            window.alert("Message cannot be empty")
            return
        }

        try {
            await this.uploadMessageToFeed(this.state.message)
            this.setState({message: ''})
        } catch (e) {
            console.log(e)
        }

        event.preventDefault();
    }

    render() {
        return (
            <Container style={{"width": "40%"}}>
                <Container
                    style={{"display": "flex", "alignItems": "stretch", "flexDirection": "column", "height": "100%"}}>
                    <GridRow style={{"flexGrow": "1"}}>
                        <ul style={{"listStyle": "none"}}>
                            {this.rules.map(value => {
                                return <li key={value}>{value}</li>
                            })}
                        </ul>
                    </GridRow>
                    <GridRow style={{"flexGrow": "0"}}>
                        <Header as='h3'>Send your message</Header>
                    </GridRow>
                    <GridRow style={{"flexGrow": "0"}}>
                        <TextArea value={this.state.message} onChange={this.handleInputChange} name="message" disabled={!this.state.ready}
                                  placeholder="Enter your message" style={{"width": "100%"}}/>
                        <Button onClick={this.handleSubmit} disabled={!this.state.ready}
                                style={{"display": "block", "position": "relative", "float": "right"}}>Send</Button>
                    </GridRow>
                </Container>
            </Container>
        );
    }
}