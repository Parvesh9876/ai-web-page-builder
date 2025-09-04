import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  // State management
  const [userPrompt, setUserPrompt] = useState('');
  const [conversation, setConversation] = useState(() => {
    const saved = localStorage.getItem('lastConversation');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const conversationEndRef = useRef(null);
  const conversationContainerRef = useRef(null);
  const previewRef = useRef(null);

  // Initialize the Google Generative AI
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lastConversation', JSON.stringify(conversation));
  }, [conversation]);

  // Scroll to bottom of conversation
  useEffect(() => {
    if (conversationEndRef.current && conversationContainerRef.current) {
      const container = conversationContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [conversation]);

  // Start a new chat
  const startNewChat = () => {
    setConversation([]);
    setUserPrompt('');
    setError('');
    setShowPreview(false);
    setActiveTab('preview');
    localStorage.removeItem('lastConversation');
  };

  // Load last chat
  const loadLastChat = () => {
    const saved = localStorage.getItem('lastConversation');
    if (saved) {
      setConversation(JSON.parse(saved));
      setShowPreview(true);
      setActiveTab('preview');
    }
  };

  // Function to handle the generation of the webpage
  const generateWebpage = async () => {
    if (!userPrompt.trim()) {
      setError('Please enter a description for your webpage');
      return;
    }

    setIsLoading(true);
    setError('');

    // Add user message to conversation
    const userMessage = { role: 'user', content: userPrompt, timestamp: new Date() };
    setConversation(prev => [...prev, userMessage]);

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-preview-05-20",
      });

      const previousHTML = getLatestHTML();
      const fullPrompt = previousHTML
        ? `You are a skilled full-stack developer. Modify the existing webpage based on the user's new request. Use Tailwind CSS for styling and include smooth animations. Provide the updated HTML content that would go inside the body, including any comments or <style> tags for custom animations. Maintain the existing structure and styling unless specified otherwise.

Previous HTML:
\`\`\`html
${previousHTML}
\`\`\`

User Request: ${userPrompt}`
        : `You are a skilled full-stack developer. Create a webpage based on the user's request. Use Tailwind CSS for styling and add modern, responsive design with smooth animations. Provide the HTML content that goes inside the body, including any comments or <style> tags for custom animations.

User Request: ${userPrompt}`;

      const result = await model.generateContentStream(fullPrompt);
      let fullResponse = '';
      let aiMessage = {
        role: 'assistant',
        content: '',
        html: '',
        timestamp: new Date()
      };

      setConversation(prev => [...prev, aiMessage]);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;

        aiMessage.content = fullResponse;

        const htmlMatch = fullResponse.match(/```html\n([\s\S]*?)\n```/) ||
          fullResponse.match(/<([a-z][a-z0-9]*)\b[^>]*>/i);

        if (htmlMatch && htmlMatch[1]) {
          aiMessage.html = htmlMatch[1];
        } else if (htmlMatch) {
          aiMessage.html = fullResponse;
        }

        setConversation(prev => {
          const newConversation = [...prev];
          newConversation[newConversation.length - 1] = { ...aiMessage };
          return newConversation;
        });
      }

      setConversation(prev => {
        const newConversation = [...prev];
        newConversation[newConversation.length - 1] = {
          ...aiMessage,
          content: fullResponse,
          html: aiMessage.html || fullResponse
        };
        return newConversation;
      });

      setUserPrompt('');
      setShowPreview(true);

    } catch (err) {
      console.error('Error generating content:', err);
      setError('Failed to generate the webpage. Please try again.');

      setConversation(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error generating your webpage. Please try again.',
        html: '',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, event) => {
    if (event) event.stopPropagation();
    navigator.clipboard.writeText(text)
      .then(() => {
        const button = event.currentTarget;
        const originalText = button.innerHTML;
        button.innerHTML = '<i className="bi bi-check me-1"></i> Copied!';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  const getLatestHTML = () => {
    const assistantMessages = conversation.filter(msg => msg.role === 'assistant' && msg.html);
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].html : '';
  };

  const getLatestContent = () => {
    const assistantMessages = conversation.filter(msg => msg.role === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : '';
  };

  const openPreview = () => {
    setShowPreview(true);
    setActiveTab('preview');
    setTimeout(() => {
      if (previewRef.current) {
        previewRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const latestHTML = getLatestHTML();
  const latestContent = getLatestContent();

  // Function to create iframe content for preview
  const createIframeContent = (html) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
  };

  return (
    <div className="min-vh-100 bg-dark d-flex flex-column">
      <style>{`
        .code-block {
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: 'Fira Code', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.5;
          padding: 1rem;
          border-radius: 0.5rem;
          white-space: pre-wrap;
          overflow-x: auto;
        }
        .code-block::before {
          content: "Code Output";
          display: block;
          color: #888;
          font-size: 12px;
          margin-bottom: 0.5rem;
        }
      `}</style>

      {/* Header */}
      <header className="py-3 bg-dark border-bottom border-secondary sticky-top">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 mb-0 text-white">
              <i className="bi bi-magic me-2 text-primary"></i>
              AI Web Page Builder
            </h1>
            <div>
              <button
                className="btn btn-outline-success btn-sm me-2"
                onClick={startNewChat}
                disabled={isLoading}
              >
                <i className="bi bi-plus-circle me-1"></i> New Chat
              </button>
              <button
                className="btn btn-outline-warning btn-sm me-2"
                onClick={loadLastChat}
                disabled={isLoading || !localStorage.getItem('lastConversation')}
              >
                <i className="bi bi-arrow-clockwise me-1"></i> Load Last Chat
              </button>
              <button className="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#helpModal">
                <i className="bi bi-question-circle me-1"></i> Guide
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container-fluid flex-grow-1 d-flex flex-column py-3">
        <div className="row flex-grow-1">
          <div className="col-12">
            <div className="card bg-dark border-secondary mb-3">
              <div className="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-chat-left-text me-2"></i> Conversation
                </span>
                {conversation.length > 0 && (
                  <button
                    className="btn btn-sm btn-outline-light"
                    onClick={startNewChat}
                    title="Start new conversation"
                    disabled={isLoading}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                )}
              </div>
              <div
                ref={conversationContainerRef}
                className="conversation-container p-3"
                style={{ maxHeight: '50vh', overflowY: 'auto' }}
              >
                {conversation.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-chat-dots display-4 d-block mb-3"></i>
                    <p>Start a conversation by describing your webpage below</p>
                    <small className="text-light-emphasis">Code with comments and styles will be shown clearly in the "Code" tab</small>
                  </div>
                ) : (
                  <>
                    {conversation.map((message, index) => (
                      <div key={index} className={`mb-3 ${message.role === 'user' ? 'text-end' : ''}`}>
                        <div className={`d-inline-block p-3 rounded ${message.role === 'user' ? 'bg-primary text-white' : 'bg-light text-dark'}`} style={{ maxWidth: '80%' }}>
                          {message.role === 'user' ? (
                            <div>{message.content}</div>
                          ) : (
                            <div>
                              <div className="font-monospace small code-block">
                                {message.content}
                              </div>
                              {message.html && (
                                <div className="mt-2">
                                  <button
                                    className="btn btn-sm btn-outline-dark"
                                    onClick={openPreview}
                                  >
                                    <i className="bi bi-eye me-1"></i> View Result
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-dark ms-2"
                                    onClick={(e) => copyToClipboard(message.html, e)}
                                  >
                                    <i className="bi bi-clipboard me-1"></i> Copy Code
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-1">
                            <small className={`${message.role === 'user' ? 'text-light' : 'text-muted'}`}>
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </small>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={conversationEndRef} />
                  </>
                )}

                {isLoading && (
                  <div className="text-center">
                    <div className="spinner-border text-primary mb-2" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted">Generating your webpage...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="col-12 mt-3">
              <div className="card bg-dark border-secondary">
                <div className="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
                  <span>
                    <i className="bi bi-layout-text-window me-2"></i> Preview
                  </span>
                  <div>
                    {latestHTML && (
                      <button
                        className="btn btn-sm btn-outline-light me-2"
                        onClick={() => setFullscreenPreview(true)}
                      >
                        <i className="bi bi-arrows-fullscreen me-1"></i> Fullscreen
                      </button>
                    )}
                    <div className="btn-group" role="group">
                      <button
                        className={`btn btn-sm ${activeTab === 'preview' ? 'btn-light' : 'btn-outline-light'}`}
                        onClick={() => setActiveTab('preview')}
                      >
                        Preview
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'code' ? 'btn-light' : 'btn-outline-light'}`}
                        onClick={() => setActiveTab('code')}
                      >
                        Code
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0 position-relative preview-container" ref={previewRef} style={{ height: '50vh' }}>
                  {activeTab === 'preview' && latestHTML ? (
                    <div className="p-3 bg-light text-dark h-100 overflow-auto">
                      <div className="alert alert-info mb-3">
                        <i className="bi bi-info-circle me-2"></i>
                        Preview includes Tailwind CSS for styling. Copy the code from the "Code" tab for full HTML, including comments and styles.
                      </div>
                      <iframe
                        srcDoc={createIframeContent(latestHTML)}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Webpage Preview"
                      />
                    </div>
                  ) : activeTab === 'code' && latestContent ? (
                    <pre className="code-block h-100 overflow-auto mb-0">
                      <code>{latestContent}</code>
                    </pre>
                  ) : (
                    <div className="d-flex justify-content-center align-items-center h-100">
                      <div className="text-center text-muted p-4">
                        <i className="bi bi-code-slash display-4 d-block mb-3"></i>
                        <p>No content to display</p>
                        <small className="text-muted">Generate a webpage first. The "Code" tab shows full content with comments and styles.</small>
                      </div>
                    </div>
                  )}
                </div>
                {(latestHTML || latestContent) && (
                  <div className="card-footer bg-secondary d-flex justify-content-end">
                    {activeTab === 'preview' && latestHTML && (
                      <button
                        className="btn btn-sm btn-outline-light me-2"
                        onClick={(e) => copyToClipboard(latestHTML, e)}
                      >
                        <i className="bi bi-clipboard me-1"></i> Copy HTML
                      </button>
                    )}
                    {activeTab === 'code' && latestContent && (
                      <button
                        className="btn btn-sm btn-outline-light"
                        onClick={(e) => copyToClipboard(latestContent, e)}
                      >
                        <i className="bi bi-clipboard me-1"></i> Copy Code
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="row mt-3">
          <div className="col-12">
            <div className="card bg-dark border-secondary">
              <div className="card-header bg-secondary text-white">
                <i className="bi bi-chat-dots me-2"></i> Describe your webpage
                <small className="ms-2 text-light-emphasis">(Continue the conversation or modify the previous webpage. Code with comments and styles will be shown in the "Code" tab.)</small>
              </div>
              <div className="card-body">
                {error && (
                  <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>{error}</div>
                  </div>
                )}

                <div className="mb-3">
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Example: Create a webpage with a centered 'Hey' message using Tailwind CSS, or modify the existing page to change the text to 'Hello World'..."
                    className="form-control bg-dark text-light border-secondary"
                    rows="2"
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        generateWebpage();
                      }
                    }}
                  />
                </div>

                <div className="d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {conversation.length} messages • {userPrompt.length} characters
                  </small>
                  <button
                    onClick={generateWebpage}
                    disabled={isLoading || !userPrompt.trim()}
                    className={`btn btn-primary px-4 ${isLoading ? 'disabled' : ''}`}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Generating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send me-2"></i>
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {fullscreenPreview && latestHTML && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }} id="fullscreenModal">
          <div className="modal-dialog modal-fullscreen">
            <div className="modal-content bg-dark">
              <div className="modal-header bg-secondary text-white border-bottom border-light">
                <h5 className="modal-title">
                  <i className="bi bi-eye me-2"></i> Fullscreen Preview
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                  onClick={() => setFullscreenPreview(false)}
                  style={{ filter: 'invert(1)', opacity: 1 }}
                ></button>
              </div>
              <div className="modal-body p-0">
                <iframe
                  srcDoc={createIframeContent(latestHTML)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Fullscreen Webpage Preview"
                />
              </div>
              <div className="modal-footer bg-secondary border-top border-light">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  data-bs-dismiss="modal"
                  onClick={() => setFullscreenPreview(false)}
                >
                  <i className="bi bi-x-circle me-1"></i> Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <div className="modal fade" id="helpModal" tabIndex="-1" aria-labelledby="helpModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content bg-dark text-light">
            <div className="modal-header bg-secondary">
              <h5 className="modal-title" id="helpModalLabel">
                <i className="bi bi-question-circle me-2"></i> AI Web Page Builder Guide
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <h5>How to Use</h5>
              <ol>
                <li>Describe the webpage you want in the text area below (e.g., "Create a webpage with a centered 'Hey' message using Tailwind CSS").</li>
                <li>Click Send or press Enter to generate the webpage.</li>
                <li>View the conversation in the center panel; raw code with comments is shown.</li>
                <li>Click "View Result" to see the rendered webpage in the "Preview" tab or raw code in the "Code" tab.</li>
                <li>Use "Load Last Chat" to continue modifying the previous webpage.</li>
                <li>Use fullscreen mode for a better view; click the close button or "Close" in the footer to exit.</li>
              </ol>

              <h5>Features</h5>
              <ul>
                <li><strong>Conversation Interface</strong> - Chat with the AI to create or modify webpages.</li>
                <li><strong>Live Generation</strong> - See code as it's generated, with comments and styles preserved.</li>
                <li><strong>Auto-scroll</strong> - Conversation scrolls to the latest message.</li>
                <li><strong>Preview</strong> - Renders the webpage with Tailwind CSS support.</li>
                <li><strong>Code View</strong> - Shows full HTML, including comments and styles, clearly formatted.</li>
                <li><strong>Fullscreen Preview</strong> - View the webpage distraction-free.</li>
                <li><strong>Last Chat</strong> - Resume editing your previous webpage.</li>
              </ul>

              <h5>Tips</h5>
              <ul>
                <li>Be specific in your prompts for better results (e.g., "Change the text to 'Hello World'").</li>
                <li>Use the "Code" tab to view raw HTML, including comments and styles.</li>
                <li>Copy code from the "Code" tab for use in your project; include Tailwind CSS CDN for styling.</li>
                <li>Use "New Chat" to start fresh or "Load Last Chat" to modify the previous webpage.</li>
              </ul>
            </div>
            <div className="modal-footer bg-secondary">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-3 bg-dark border-top border-secondary mt-auto">
        <div className="container">
          <div className="row">
            <div className="col-md-12 text-center text-muted">
              <p className="mb-0 small">
                <i className="bi bi-c-circle"></i> 2023 AI Web Page Builder • Powered by Google Gemini AI
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;