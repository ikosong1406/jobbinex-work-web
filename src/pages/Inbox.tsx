import React, { useState } from "react";
import { FaPaperclip, FaPaperPlane, FaBars, FaSearch } from "react-icons/fa";

const Inbox: React.FC = () => {
  const [clients] = useState([
    {
      id: 1,
      name: "Sarah Johnson",
      avatar: "https://i.pravatar.cc/60?img=5",
      online: true,
      messages: [
        {
          id: 1,
          sender: "assistant",
          text: "Hey there 👋 I’ve found three new roles that match your profile perfectly! Would you like me to shortlist them?",
          time: "09:12 AM",
        },
        {
          id: 2,
          sender: "client",
          text: "Sure, please go ahead. I’d like something related to marketing if possible.",
          time: "09:16 AM",
        },
      ],
    },
    {
      id: 2,
      name: "Michael Brown",
      avatar: "https://i.pravatar.cc/60?img=7",
      online: false,
      messages: [
        {
          id: 1,
          sender: "assistant",
          text: "I noticed you haven’t uploaded your CV yet. Would you like me to help format it?",
          time: "10:45 AM",
        },
      ],
    },
  ]);

  const [selectedClient, setSelectedClient] = useState<any>(clients[0]);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSendMessage = () => {
    if (newMessage.trim() === "") return;
    const newMsg = {
      id: Date.now(),
      sender: "client",
      text: newMessage,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setSelectedClient({
      ...selectedClient,
      messages: [...selectedClient.messages, newMsg],
    });
    setNewMessage("");
    setAttachments([]);
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      setAttachments([...attachments, ...Array.from(e.target.files)]);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-inter">
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

        <div className="flex-1 overflow-y-auto mt-2">
          {clients.map((client) => (
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
                  {client.messages[client.messages.length - 1]?.text}
                </p>
              </div>
            </div>
          ))}
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
            {selectedClient && (
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
            )}
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-gray-50">
          {selectedClient?.messages.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex items-end ${
                msg.sender === "client" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender !== "client" && (
                <img
                  src={selectedClient.avatar}
                  alt={selectedClient.name}
                  className="w-8 h-8 rounded-full mr-3"
                />
              )}
              <div
                className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                  msg.sender === "client"
                    ? "bg-[var(--color-primary)] text-white rounded-br-none"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                }`}
              >
                {msg.text}
                <div
                  className={`text-xs mt-1 ${
                    msg.sender === "client"
                      ? "text-blue-100 text-right"
                      : "text-gray-500"
                  }`}
                >
                  {msg.time}
                </div>
              </div>
              {msg.sender === "client" && (
                <div className="w-8 h-8 rounded-full ml-3 bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-semibold">
                  You
                </div>
              )}
            </div>
          ))}
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
        <div className="bg-white border-t border-gray-200 p-4 flex items-center gap-3 sticky bottom-0 shadow-md">
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
            onClick={handleSendMessage}
            className="p-3 rounded-full bg-[var(--color-primary)] text-white transition"
          >
            <FaPaperPlane size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Inbox;
