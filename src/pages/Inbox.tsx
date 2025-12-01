import React, { useState, useEffect } from "react";
import { FaPaperclip, FaPaperPlane, FaBars, FaSearch } from "react-icons/fa";
import axios from "axios";
import localforage from "localforage";
import { toast, Toaster } from "react-hot-toast";
import Api from "../components/Api";

interface BackendResponse {
  resetCode: string | null;
  resetCodeExpires: string | null;
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  status: string;
  clients: Array<{
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
  }>;
  messages: Array<{
    _id: string;
    userId: {
      _id: string;
      firstname: string;
      lastname: string;
      email: string;
    };
    assistantId: string;
    conversation: Array<{
      role: string;
      content: string;
      createdAt: string;
      _id: string;
    }>;
    title: string;
    lastActivityAt: string;
    createdAt: string;
    updatedAt: string;
    __v: number;
  }>;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface Client {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  messages: Array<{
    id: string;
    sender: "assistant" | "client";
    text: string;
    time: string;
  }>;
}

const SEND_MESSAGE_ENDPOINT = `${Api}/work/sendMessage`;
const USER_DATA_ENDPOINT = `${Api}/work/userdata`;
const CREATE_CONVERSATION_ENDPOINT = `${Api}/work/createConv`;

const Inbox: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<BackendResponse | null>(null);

  // Function to format time from ISO string to readable format
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Function to generate avatar URL based on name
  const generateAvatar = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=random`;
  };

  // Function to enhance conversation data with display information
  const enhanceConversationData = (
    conversation: any,
    userData: BackendResponse
  ) => {
    const clientUser = conversation.userId;
    const lastMessage =
      conversation.conversation[conversation.conversation.length - 1];

    return {
      id: conversation._id,
      name: `${clientUser.firstname} ${clientUser.lastname}`,
      avatar: generateAvatar(`${clientUser.firstname} ${clientUser.lastname}`),
      online: true, // You might want to add online status logic based on your requirements
      messages: conversation.conversation.map((conv: any) => ({
        id: conv._id,
        sender: conv.role === "user" ? "client" : "assistant",
        text: conv.content,
        time: formatTime(conv.createdAt),
      })),
    };
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = await localforage.getItem("authToken");

        if (!token) {
          console.error("Session expired or token missing. Please log in.");
          // handleLogout(); // Uncomment if you have logout functionality
          return;
        }

        const response = await axios.get<BackendResponse>(USER_DATA_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const userData = response.data;
        setUserData(userData);

        // Transform the API data into the format expected by the component
        const transformedClients: Client[] = userData.messages.map(
          (message) => {
            return enhanceConversationData(message, userData);
          }
        );

        setClients(transformedClients);

        // Set the first client as selected if available
        if (transformedClients.length > 0) {
          setSelectedClient(transformedClients[0]);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error("Failed to load messages.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !selectedClient || !userData) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage("");

    const newEntry = {
      id: Date.now().toString(),
      sender: "assistant" as const,
      text: messageContent,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Optimistic UI Update
    const updatedClient = {
      ...selectedClient,
      messages: [...selectedClient.messages, newEntry],
    };

    setSelectedClient(updatedClient);
    setClients((prev) =>
      prev.map((client) =>
        client.id === updatedClient.id ? updatedClient : client
      )
    );

    try {
      const token = await localforage.getItem("authToken");
      if (!token) {
        toast.error("Session expired.");
        return;
      }

      // Send message to backend
      await axios.post(
        SEND_MESSAGE_ENDPOINT,
        {
          messageId: selectedClient.id,
          role: "assistant", // Assistant is sending the message
          content: messageContent,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Message send failed:", err);
      toast.error("Failed to send message.");

      // Revert optimistic update on failure
      setSelectedClient((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((msg) => msg.id !== newEntry.id),
            }
          : null
      );
      setClients((prev) =>
        prev.map((client) =>
          client.id === selectedClient.id ? selectedClient : client
        )
      );
    }
  };

  const createNewConversation = async (clientId: string) => {
    if (!userData) {
      toast.error("Assistant data not loaded.");
      return;
    }

    try {
      const token = await localforage.getItem("authToken");
      if (!token) {
        toast.error("Authentication required.");
        return;
      }

      const createResponse = await axios.post<{
        message: string;
        conversation: any;
      }>(
        CREATE_CONVERSATION_ENDPOINT,
        {
          assistantId: userData._id, // Assistant's own ID
          userId: clientId, // The client we're starting conversation with
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const newConversation = createResponse.data.conversation;
      const enhancedClient = enhanceConversationData(newConversation, userData);

      // Add the new conversation to clients list
      setClients((prev) => [enhancedClient, ...prev]);
      setSelectedClient(enhancedClient);

      toast.success("New conversation started!");
    } catch (err) {
      console.error("Conversation creation failed:", err);
      toast.error("Failed to create new conversation.");
    }
  };

  // const fetchOrCreateConversation = async () => {
  //   if (!userData) {
  //     toast.error("Assistant data not loaded.");
  //     return;
  //   }

  //   // If we already have conversations, no need to create new one
  //   if (clients.length > 0) {
  //     return;
  //   }

  //   try {
  //     const token = await localforage.getItem("authToken");
  //     if (!token) {
  //       toast.error("Authentication required.");
  //       return;
  //     }

  //     // For assistant, we might want to show all their conversations
  //     // or create a new one with a specific client
  //     // This is a placeholder - adjust based on your requirements
  //     if (userData.messages && userData.messages.length > 0) {
  //       // Use existing conversations
  //       const transformedClients: Client[] = userData.messages.map((message) => {
  //         return enhanceConversationData(message, userData);
  //       });
  //       setClients(transformedClients);
  //       if (transformedClients.length > 0) {
  //         setSelectedClient(transformedClients[0]);
  //       }
  //     } else {
  //       // No existing conversations - assistant can start new ones with clients
  //       toast.info("No conversations yet. Select a client to start chatting.");
  //     }

  //   } catch (err) {
  //     console.error("Conversation fetch failed:", err);
  //     toast.error("Failed to load conversations.");
  //   }
  // };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      setAttachments([...attachments, ...Array.from(e.target.files)]);
  };

  // Start a new conversation with a client from the clients list
  const startNewConversationWithClient = (client: any) => {
    createNewConversation(client._id);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100 items-center justify-center">
        <div className="text-lg text-gray-600">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-inter">
      <Toaster />
      {/* Sidebar (Clients List) */}
      <div
        className={`fixed lg:static top-0 left-0 h-full bg-white border-r border-gray-200 w-72 flex flex-col transition-transform duration-300 z-30
        ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            ✖
          </button>
        </div>

        <div className="p-3 flex items-center bg-gray-50 mx-3 rounded-lg">
          <FaSearch className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search clients..."
            className="flex-1 text-sm bg-transparent focus:outline-none"
          />
        </div>

        {/* Clients available for new conversations */}
        {userData?.clients && userData.clients.length > 0 && (
          <div className="px-4 py-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Start New Conversation
            </h3>
            {userData.clients.map((client) => (
              <div
                key={client._id}
                onClick={() => startNewConversationWithClient(client)}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-all duration-150 hover:bg-gray-100 rounded-lg mb-1"
              >
                <img
                  src={generateAvatar(`${client.firstname} ${client.lastname}`)}
                  alt={`${client.firstname} ${client.lastname}`}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    {client.firstname} {client.lastname}
                  </h3>
                  <p className="text-xs text-gray-500">Start conversation</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-2">
          {clients.length === 0 ? (
            <div className="text-center text-gray-500 mt-8 px-4">
              <p>No conversations yet</p>
              <p className="text-sm mt-2">
                Select a client above to start chatting
              </p>
            </div>
          ) : (
            clients.map((client) => (
              <div
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 hover:bg-gray-100
                ${
                  selectedClient?.id === client.id
                    ? "bg-gray-100 border-l-4 border-[var(--color-primary)]"
                    : ""
                }`}
              >
                <img
                  src={client.avatar}
                  alt={client.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-900">
                      {client.name}
                    </h3>
                    {client.online && (
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {client.messages[client.messages.length - 1]?.text ||
                      "No messages yet"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-600"
              onClick={() => setSidebarOpen(true)}
            >
              <FaBars size={18} />
            </button>
            {selectedClient ? (
              <>
                <img
                  src={selectedClient.avatar}
                  alt={selectedClient.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedClient.name}
                  </h2>
                  <p
                    className={`text-xs ${
                      selectedClient.online ? "text-green-500" : "text-gray-400"
                    }`}
                  >
                    {selectedClient.online ? "Online" : "Offline"}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-gray-500">
                Select a conversation to start chatting
              </div>
            )}
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-gray-50">
          {!selectedClient ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg">Welcome to your inbox</p>
                <p className="mt-2">Select a conversation or start a new one</p>
              </div>
            </div>
          ) : selectedClient.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg">No messages yet</p>
                <p className="mt-2">
                  Start the conversation by sending a message
                </p>
              </div>
            </div>
          ) : (
            selectedClient.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end ${
                  msg.sender === "client" ? "justify-start" : "justify-end" // Fixed: client on left, assistant on right
                }`}
              >
                {msg.sender === "client" && (
                  <img
                    src={selectedClient.avatar}
                    alt={selectedClient.name}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                )}
                <div
                  className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                    msg.sender === "client"
                      ? "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                      : "bg-[var(--color-primary)] text-white rounded-br-none"
                  }`}
                >
                  {msg.text}
                  <div
                    className={`text-xs mt-1 ${
                      msg.sender === "client"
                        ? "text-gray-500"
                        : "text-blue-100 text-right"
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
                {msg.sender === "assistant" && (
                  <div className="w-8 h-8 rounded-full ml-3 bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-semibold">
                    You
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="bg-white border-t border-gray-100 px-6 py-3 text-sm text-gray-600">
            <p className="font-medium mb-1">Attachments:</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 rounded-full text-xs"
                >
                  📎 {file.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        {selectedClient && (
          <form
            onSubmit={handleSendMessage}
            className="bg-white border-t border-gray-200 p-4 flex items-center gap-3 sticky bottom-0 shadow-md"
          >
            <label
              htmlFor="attachment"
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer transition"
            >
              <FaPaperclip size={18} className="text-gray-600" />
            </label>
            <input
              id="attachment"
              type="file"
              multiple
              className="hidden"
              onChange={handleAttachment}
            />

            <input
              type="text"
              placeholder={`Message ${selectedClient?.name || "client"}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button
              type="submit"
              className="p-3 rounded-full bg-[var(--color-primary)] text-white transition hover:bg-[var(--color-primary-dark)]"
            >
              <FaPaperPlane size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Inbox;
