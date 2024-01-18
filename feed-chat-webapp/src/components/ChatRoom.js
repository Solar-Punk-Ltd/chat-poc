import {Header, Container, Divider} from "semantic-ui-react"
import React from "react";
import ChatWrite from "./ChatWrite.js";
import ChatStream from "./ChatStream.js";
import { useParams } from "react-router-dom";

export function withRouter( Child ) {
    return ( props ) => {
        const params = useParams();
        return <Child { ...props } params ={ params } />;
    }
}

class ChatRoom extends React.Component {
    constructor(props) {
        super(props);
        this.state = {room: {},hash:props.params.hash};
        this.setRoom()
    }

    setRoom() {
        let chats = JSON.parse(localStorage.getItem('chats') || '[]');
        const chatIndex = chats.findIndex((chat) => chat.hash === this.state.hash);

        if(chatIndex===-1){
            console.log('Chat room not found');
            return this.navigate('/chat');
        }

        this.state.room = chats[chatIndex];
    }

    navigate(path){
        window.location.href = path;
    }

    render() {
        return <div>
            <Header as='h3'>Chat Page: {this.state.room.id}::{this.state.room.room}</Header>
            <Container style={{"display":"flex","alignItems":"stretch","flexDirection": "row"}}>
                <Header as='h4'  style={{
                    "display": "flex",
                    "flexDirection": "column-reverse",
                    "alignItems": "stretch",
                    "position": "relative",
                    "float": "left",
                    "width": "60%",
                }}>Chat Stream</Header>
                <Header as='h4' style={{
                    "display": "flex",
                    "flexDirection": "column-reverse",
                    "alignItems": "stretch",
                    "position": "relative",
                    "float": "left",
                    "width": "40%",
                }}>Chat Rules</Header>
            </Container>
            <Container style={{"display":"flex","alignItems":"stretch","flexDirection": "row"}}>
                <ChatStream hash={this.state.room.hash} />
                <ChatWrite hash={this.state.room.hash} />
            </Container>
        </div>
    }
}

export default withRouter(ChatRoom);