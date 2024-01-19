import { useEffect, useState } from 'react';
import { Bee, Utils } from '@ethersphere/bee-js';
import './App.css';
import { toast } from 'react-toastify';
const STAMP = "733976cce45c4164ccfc3dda44d2c664256e90cadd808e57cdc63ffcfbe1bc1e"
//dev"b6a0a89edaf33580f9811a868eb5d8cbad400989110d9f10a7d2dfea0dfb688a";


function App() {
  const [conversationID, setConversationID] = useState("");           // This will be hashed to create the 'topic'
  const [recipientAddress, setRecipientAddress] = useState("");       // Address of the other person
  const [ourAddress, setOurAddress] = useState("");                   // Our Ethereum address
  const [signer, setSigner] = useState(null);                         // Signer that we will use to send new messages
  const [lastMessage, setLastMessage] = useState({                    // Last received message
    text: "NO-MESSAGE", 
    timestamp: 0
  });
  const [newMessage, setNewMessage] = useState("");                   // New message to be sent
  const [bee, setBee] = useState(null);                               // Bee instance
  const [buttonActive, setButtonActive] = useState(true);             // Deactivate button, while loading

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

  async function readFeed() {
    setButtonActive(false);
    const readFeedPromise = new Promise(async function(resolve, reject) {
      try {
        const data = await bee.getJsonFeed(conversationID, { address: recipientAddress });
        setLastMessage(data);
        setButtonActive(true);
        resolve();
      } catch (error) {
        console.error("There was an error while trying to read the last message. Either the conversation name, or the address is wrong.");
        reject({error: "Read failed. Either the conversation name, or the address is wrong."});
      }
    });

    toast.promise(
      readFeedPromise,
      {
        pending: "Reading last message...",
        success: "Last message was read",
        error: {
          render({data}) {
            return `${data.error}`
          }
        }
      }
    );
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
      <button disabled={!buttonActive} onClick={readFeed}>Read</button>

      <p>Received Message:</p>
      <p>{lastMessage.text}</p>

      <p>New Message:</p>
      <p>
        <textarea 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
      </p>
      <button disabled={!buttonActive} onClick={sendMessage}>Send</button>

    </div>
  );
}

export default App;
