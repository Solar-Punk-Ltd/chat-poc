import { Header } from "semantic-ui-react"
import React from "react";

export default class MainPage extends React.Component {
    componentDidMount() {
        window.dispatchEvent(new CustomEvent('readableStateChanged', {detail: {allowRead: false}}));
    }

    render() {
        return <div>
            <Header as='h3'>Swarm Feed chat application</Header>
        </div>
    }
}