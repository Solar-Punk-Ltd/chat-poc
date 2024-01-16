import React, { useEffect, useState } from 'react';
import { Bee, Utils } from '@ethersphere/bee-js';


export default function History() {
  const [conversationID, setConversationID] = useState("");           // This will be hashed to create the 'topic'
  const [recipientAddress, setRecipientAddress] = useState("");       // Address of the other person
  const [ourAddress, setOurAddress] = useState("");                   // Our Ethereum address
  const [signer, setSigner] = useState(null);                         // Signer that we will use to send new messages
  const [allMessages, setAllMessages] = useState([]);                 // All the messages
  const [newMessage, setNewMessage] = useState("");                   // New message to be sent
  const [bee, setBee] = useState(null);                               // Bee instance

  useEffect(() => {
    loader();
  }, []);

  async function loader() {
    try {
      if (!window.ethereum) throw "You don't have Metamask!";

      const signer = await Utils.makeEthereumWalletSigner(window.ethereum);
      setSigner(signer);
      setOurAddress(`0x${toHexString(signer.address)}`);
      const tempBee = new Bee('http://195.88.57.155:1633', signer);
      setBee(tempBee);

    } catch (error) {
      console.error("There was an error while connecting to Metamask: ", error);
    }
  }

  function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
  }

  async function readMessages() {
    const topic = bee.makeFeedTopic(conversationID);
    const ourReader = bee.makeFeedReader('sequence', topic, ourAddress);
    const recipientReader = bee.makeFeedReader('sequence', topic, recipientAddress);
    const ourIndex = await getIndex(topic, ourAddress);
    const recipientIndex = await getIndex(topic, recipientAddress);
    const ourList = [];
    const recipientList = [];
    const textEncoder = new TextDecoder();
    const finalList = [];
    
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
    for (let i = 0; i < recipientIndex; i++) {
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
    console.log("Final list: ", sortedAll);
  }

  async function getIndex(theTopic, theAddress) {
    const indexReader = bee.makeFeedReader('sequence', theTopic, theAddress);
    const result = await indexReader.download();
    return Number(result.feedIndex)
  }


  return (
    <div className="App">
      <p>Your Ethereum address: {ourAddress}</p>
      <p>Recipient's Ethereum address: 
        <input 
          type={'text'} 
          placeholder={"Copy address here"}
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
        />
      </p>
      <p>Conversation name: 
        <input 
          type={'text'} 
          placeholder={"topic-42"} 
          value={conversationID} 
          onChange={(e) => setConversationID(e.target.value)}
        />
      </p>
      <button onClick={readMessages}>Read</button>

      <ul id="messageList">
        {allMessages.map((message) => (
          <li key={message.timestamp} className={message.address == ourAddress ? "singleMessage firstParticipant" : "singleMessage secondParticipant"}>
            <p className="messageText">{message.text}</p>
            <div className="messageSender">
              <p>{message.address}</p>
              <p>{new Date(message.timestamp).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
