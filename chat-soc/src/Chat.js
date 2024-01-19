import React, { useEffect, useState } from 'react';
import { Bee, Utils } from '@ethersphere/bee-js';
import './App.css';
import { toast } from 'react-toastify';
const STAMP = "733976cce45c4164ccfc3dda44d2c664256e90cadd808e57cdc63ffcfbe1bc1e"
//dev"b6a0a89edaf33580f9811a868eb5d8cbad400989110d9f10a7d2dfea0dfb688a";
const NODE_ADDRESS = "http://195.88.57.155";


export default function Chat() {
  const [conversationID, setConversationID] = useState("");           // This will be hashed to create the 'topic'
  const [recipientAddress, setRecipientAddress] = useState("");       // Address of the other person
  const [ourAddress, setOurAddress] = useState("");                   // Our Ethereum address
  const [signer, setSigner] = useState(null);                         // Signer that we will use to send new messages
  const [allMessages, setAllMessages] = useState([]);                 // All the messages
  const [newMessage, setNewMessage] = useState("");                   // New message to be sent
  //const [bee, setBee] = useState(null);                               // Bee instance
  const [buttonActive, setButtonActive] = useState(true);             // Deactivate button, while loading
  const [lastRefresh, setLastRefresh] = useState(null);                // Last refresh, unix timestamp
  const [elapsedSeconds, setElapsedSeconds] = useState("loading..."); // "loading..." or a number, in seconds

  useEffect(() => {
    loader();
  }, []);

  useEffect(() => {
    if (ourAddress.length > 0) {
      console.log("ourAddress: ", ourAddress)
      const intervalId = setInterval(readMessages, 2000);
      return () => {
        clearInterval(intervalId);
        
      }
    }
  }, [ourAddress]);

  useEffect(() => {
    if (allMessages.length > 0) {
      calculateSeconds()
      const refreshIntervalId = setInterval(calculateSeconds, 900);
      clearInterval(refreshIntervalId);
    }
  }, [allMessages]);

  async function loader() {
    try {
      if (!window.ethereum) throw "You don't have Metamask!";

      const signer = await Utils.makeEthereumWalletSigner(window.ethereum);
      setSigner(signer);
      console.log("Signer: ", signer)
      setOurAddress(`0x${toHexString(signer.address)}`);
      //setBee(tempBee);
      readMessages();

      const rec = localStorage.getItem('recipient');
      const convID = localStorage.getItem('conversationID');
      if (rec) setRecipientAddress(rec);
      if (convID) setConversationID(convID);
    } catch (error) {
      console.error("There was an error while connecting to Metamask: ", error);
    }
  }

  function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
  }

  async function sendMessage() {
    setButtonActive(false);
    const bee = new Bee(`${NODE_ADDRESS}:1633`, signer);
    const sendMessagePromise = new Promise(async function(resolve, reject) {
      const message = {
        text: newMessage,
        timestamp: Date.now()
      }
  
      const result = await bee.setJsonFeed(STAMP, conversationID, message, { signer: signer, type: 'sequence' } );
      console.log("Result: ", result)
  
      localStorage.setItem('recipient', recipientAddress);
      localStorage.setItem('conversationID', conversationID);

      setButtonActive(true);
      if (result) resolve();
      else reject();
    });

    toast.promise(
      sendMessagePromise,
      {
        pending: "Waiting...",
        success: "Done.",
        error: "Error."
      }
    );
  }

  async function readMessages() {
    if (!buttonActive || ourAddress.length == 0 || recipientAddress.length == 0) { 
      return; 
    };
    //setButtonActive(false);
    
    try {
      const bee = new Bee(`${NODE_ADDRESS}:1633`, signer);
      const topic = bee.makeFeedTopic(conversationID);
      const ourReader = bee.makeFeedReader('sequence', topic, ourAddress);
      const recipientReader = bee.makeFeedReader('sequence', topic, recipientAddress);
      const ourIndex = await getIndex(topic, ourAddress);
      const recipientIndex = await getIndex(topic, recipientAddress);
      if (ourIndex === -1 || recipientIndex === -1) {
        if (ourIndex === -1 && recipientIndex === -1) {
          // Wrong topic
          throw "Most likely the conversation name is not correct.";
        } else {
          // Wrong address
          throw "Most likely the address is not correct.";
        }
      }
      const ourList = [];
      const recipientList = [];
      const textEncoder = new TextDecoder();
  
      localStorage.setItem('recipient', recipientAddress);
      localStorage.setItem('conversationID', conversationID);
      
      // Read our feed
      for (let i = 0; i <= ourIndex; i++) {
          const ourResult = await ourReader.download({ index: i });
          const rawData = await bee.downloadData(ourResult.reference);
          const text = textEncoder.decode(rawData)
          const resultObj = JSON.parse(text);
          resultObj.address = ourAddress;
          ourList.push(resultObj);
      }
  
      // Read recipient's feed
      for (let i = 0; i <= recipientIndex; i++) {
          const recipientResult = await recipientReader.download({ index: i });
          const rawData = await bee.downloadData(recipientResult.reference);
          const text = textEncoder.decode(rawData)
          const resultObj = JSON.parse(text);
          resultObj.address = recipientAddress;
          recipientList.push(resultObj);
      }
  
  
      // Unify the 2 lists, pay attention to timestamps!
      console.log("ourList: ", ourList)  
      console.log("recipientList: ", recipientList)
  
      const sortedAll = [...ourList, ...recipientList].sort((messageA, messageB) => {
        return messageA.timestamp - messageB.timestamp
      });
      setAllMessages(sortedAll);
      setButtonActive(true);
      console.log("Final list: ", sortedAll); 
      const tstamp = new Date();
      console.log("Timestamp", tstamp)
      setLastRefresh(tstamp);
      //resolve();
    } catch (error) {
      console.error("There was an error while trying to fetch the messages: ", error);
      //setButtonActive(true);
      //reject({error: `Error reading messages: ${error}`});
    }

  }

  async function getIndex(theTopic, theAddress) {
    try {
      const bee = new Bee(`${NODE_ADDRESS}:1633`, signer);
      const indexReader = bee.makeFeedReader('sequence', theTopic, theAddress);
      const result = await indexReader.download();
      console.log("RESULT: ", result)
      return Number(result.feedIndex);
    } catch (error) {
      console.error("There was an error while fetching index, probably this feed does not exist: ", error);
      return -1;
    }
  }

  function calculateSeconds() {
    console.log("lastRefresh: ", lastRefresh)
    if (!lastRefresh) {
      return;
    }
    const currentTime = new Date();
    const seconds = currentTime - lastRefresh;
    setElapsedSeconds(seconds + " seconds ago");
  }

  function changeConvId(e) {
    setConversationID(e.target.value);
    localStorage.setItem('conversationID', e.target.value);
  }

  function changeRecipient(e) {
    setRecipientAddress(e.target.value);
    localStorage.setItem('recipient', e.target.value);
  }


  return (
    <div id="chatApp">
      <div id="messageBox">
        <ul id="messageList">
          {allMessages.map((message) => (
            <li key={message.timestamp} className={message.address == ourAddress ? "singleMessage firstParticipant" : "singleMessage secondParticipant"}>
              <p className="messageText">{message.text}</p>
              <div className="messageSender">
                <p>{message.address == ourAddress ? "You": "Recipient"}</p>
                <p>{new Date(message.timestamp).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div id="chatControls">
        <div id="addresses">
          <p>Your Ethereum address: {ourAddress}</p>
          <p>Recipient's Ethereum address: 
            <input 
              type={'text'} 
              placeholder={"Copy address here"}
              value={recipientAddress}
              className="textInput"
              onChange={(e) => changeRecipient(e)}
            />
          </p>
        </div>
        <div id="conversationSettings">
          <p>Conversation name:
          <input 
            type={'text'} 
            placeholder={"topic-42"} 
            className="textInput"
            value={conversationID} 
            onChange={(e) => changeConvId(e)}
          />
          </p>
          <p>
            {"Last Refresh: "}{elapsedSeconds}
          </p>
        </div>
        <div id="sendMessageLine">
          <textarea 
            value={newMessage}
            className="flexGrow messageToSend"
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button disabled={!buttonActive} onClick={sendMessage}>Send</button>
        </div>
      </div>
          <button disabled={!buttonActive} onClick={readMessages}>Read</button>
    </div>
  )
}
