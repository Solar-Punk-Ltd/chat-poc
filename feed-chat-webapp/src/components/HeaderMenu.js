import React from 'react';
import {Menu} from 'semantic-ui-react';
import {Route, Routes, useNavigate} from 'react-router-dom';

import MainPage from './MainPage.js'
import ChatPage from './ChatPage.js';
import ChatRoom from './ChatRoom.js';
import NotFoundPage from './NotFoundPage.js';

export default function HeaderMenu() {
    let navigate = useNavigate();
    return (
        <>
            <Menu secondary>
                <Menu.Item
                    name="MainPage"
                    onClick={() => navigate("/")}/>
                <Menu.Item
                    name="Chat"
                    onClick={() => navigate("/chat")}/>
            </Menu>
            <Routes>
                <Route path="/" element={<MainPage />}/>
                <Route path="/chat" element={<ChatPage />}/>
                <Route path="/chatroom/:hash" element={<ChatRoom />}/>
                <Route path="*" element={<NotFoundPage/>}/>
            </Routes>
        </>
    );
}
