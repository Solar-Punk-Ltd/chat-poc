import React, { useEffect, useState } from 'react';
import { Bee, Utils } from '@ethersphere/bee-js';
import { toast } from 'react-toastify';


export default function History() {
  const [conversationID, setConversationID] = useState("");           // This will be hashed to create the 'topic'
  const [recipientAddress, setRecipientAddress] = useState("");       // Address of the other person
  const [ourAddress, setOurAddress] = useState("");                   // Our Ethereum address
  const [allMessages, setAllMessages] = useState([]);                 // All the messages
  const [bee, setBee] = useState(null);                               // Bee instance
  const [buttonActive, setButtonActive] = useState(true);             // Deactivate button, while loading

  useEffect(() => {
    loader();
  }, []);

  async function loader() {
    try {
      if (!window.ethereum) throw Error("You don't have Metamask!");

      const signer = await Utils.makeEthereumWalletSigner(window.ethereum);
      setOurAddress(`0x${toHexString(signer.address)}`);
      const tempBee = new Bee('http://195.88.57.155:1633', signer);
      setBee(tempBee);

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

  async function readMessages() {
    setButtonActive(false);
    const readPromise = new Promise(async function(resolve, reject) {
      try {
        const topic = bee.makeFeedTopic(conversationID);
        const ourReader = bee.makeFeedReader('sequence', topic, ourAddress);
        const recipientReader = bee.makeFeedReader('sequence', topic, recipientAddress);
        const ourIndex = await getIndex(topic, ourAddress);
        const recipientIndex = await getIndex(topic, recipientAddress);
        if (ourIndex === -1 || recipientIndex === -1) {
          if (ourIndex === -1 && recipientIndex === -1) {
            // Wrong topic
            throw Error("Most likely the conversation name is not correct.");
          } else {
            // Wrong address
            throw Error("Most likely the address is not correct.");
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
        resolve();
      } catch (error) {
        console.error("There was an error while trying to fetch the messages: ", error);
        setButtonActive(true);
        reject({error: `Error reading messages: ${error}`});
      }
    });

    toast.promise(
      readPromise,
      {
        pending: "Reading messages...",
        success: "Messages were read!",
        error: {
          render({data}) {
            return data.error
          }
        }
      }
    );
  }

  async function getIndex(theTopic, theAddress) {
    try {
      const indexReader = bee.makeFeedReader('sequence', theTopic, theAddress);
      const result = await indexReader.download();
      console.log("RESULT: ", result)
      return Number(result.feedIndex);
    } catch (error) {
      console.error("There was an error while fetching index, probably this feed does not exist: ", error);
      return -1;
    }
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
      <button disabled={!buttonActive} onClick={readMessages}>Read</button>

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
  )
}
