import Adapt from 'core/js/adapt';
import data from 'core/js/data';

class Conversation {
    //Build a conversaion, can be an existing one
    constructor(config,messages = [], id = "") {
        this.messages = messages;
        this.config = config;
        this.id = id;
        this.currentBlock = {};
    }

    //Add a message to a conversaion
    addMessage(message) {
        this.messages.push(message);
    }

    //Set the block
    setCurrentBlock(block) {
        this.currentBlock = block;
    }

    // Set a metadata value, with a hack!
    async set(key, value) {
        this[key] = value;

        const { clientAuthServer, apiKey } = this.config;

        let attemptCount = 0;

        const trySetMetadata = async () => {
            if (!this.id) {
                if (attemptCount >= 10) {
                    throw new Error('Conversation ID is not available after 10 attempts');
                }
                console.log('Conversation ID is not available. Waiting for it to become available...');
                await new Promise(resolve => setTimeout(resolve, 200)); // Wait for 200ms
                attemptCount++;
                await trySetMetadata(); // Retry recursively
                return;
            }

            try {
                const response = await fetch(`${clientAuthServer}/conversation/${this.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + apiKey
                    },
                    body: JSON.stringify({ [key]: value })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error('Error: ' + response.status + ' ' + response.statusText + ' - ' + errorData.error);
                }

                console.log('Metadata value set successfully');
            } catch (error) {
                throw new Error('Error setting metadata value: ' + error.message);
            }
        };

        // Start the initial attempt
        await trySetMetadata();
    }

    // Set a rating for a message
    async setRating(messageId, rating) {
        if (!this.id) {
            return;
        }

        try {
            const { clientAuthServer, apiKey } = this.config; // Destructuring apiUrl and apiKey from config
            const response = await fetch(`${clientAuthServer}/conversation/${this.id}/messages/${messageId}`, { // Constructing the URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + apiKey
                },
                body: JSON.stringify({ rating })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error('Error: ' + response.status + ' ' + response.statusText + ' - ' + errorData.error);
            }

            console.log('Rating set successfully');
        } catch (error) {
            throw new Error('Error setting rating: ' + error.message);
        }
    }

    //Get something from conversation, e.g. course
    get(key) {
        return this[key];
    }

    //Get a new conversation ID
    async setMetadata(contentObjectId) {
        // Do nothing if not using a proxy
        if (!this.config.clientAuthServer) {
            return;
        }

        this.course = {};
        this.course.id = Adapt.config.get("_courseId");
        this.course.title = Adapt.course.get('title');

        const cotemp = data.findById(contentObjectId);
        this.contentObject = {};
        this.contentObject.id = contentObjectId;
        this.contentObject.title = cotemp.get('title');

        const programmeData = Adapt.course.get("_skillsFramework") || null;
        this._skillsFramework = {};
        if (programmeData && programmeData._items[0]) {
            this._skillsFramework.programmeUri = programmeData._items[0].uri;
            this._skillsFramework.programmeTitle = programmeData._items[0].title;
        }

        const apiKey = this.config.apiKey;
        const apiUrl = this.config.apiUrl;

        const body = {
            course: this.course,
            contentObject: this.contentObject,
            _skillsFramework: this._skillsFramework
        };

        try {
            const response = await fetch(this.config.clientAuthServer + "/createConversation", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + apiKey
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error('Error: ' + response.status + ' ' + response.statusText + ' - ' + errorData.error.code + ' - ' + errorData.error.message);
            }

            const responseData = await response.json();
            this.id = responseData.id;
        } catch (error) {
            throw new Error('Error fetching response: ' + error.message);
        }
    }

    //Get response from the AI
    async getResponse() {
        //Need to to limit messages to number of tokens here, cutting of the start if necessary.
        if (this.config._testMode) {
            // Simulate a delay of 3 seconds before returning the response
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(this.config._testModeResponse);
                }, 3000); // 3000 milliseconds = 3 seconds
            });
        }

        // Clean the messages to remove any unnecessary data
        const cleanedMessages = this.messages.map(message => ({
            content: message.content,
            role: message.role
        }));

        let { apiKey, apiUrl, model, maxTokens, temperature, stop } = this.config;

        const body = {
            model,
            messages: cleanedMessages,
            max_tokens: maxTokens,
            temperature,
            n: 1,
            stop
        };

        if (this.id) {
            apiUrl = apiUrl + "/" + this.id;
            body.currentBlock = this.currentBlock;
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + apiKey
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error('Error: ' + response.status + ' ' + response.statusText + ' - ' + errorData.error.code + ' - ' + errorData.error.message);
            }
            const responseData = await response.json();
            return responseData.choices[0].message;
        } catch (error) {
            throw new Error('Error fetching response: ' + error.message);
        }
    }

    //Used to check if the AI is ready
    async getResponseCode() {
        const apiKey = this.config.apiKey;
        const apiUrl = this.config.apiUrl;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: this.messages,
                    max_tokens: this.config.maxTokens,
                    temperature: this.config.temperature,
                    n: 1,
                    stop: this.config.stop
                })
            });
            return {
                status: response.status,
                statusText: response.statusText
            };
        } catch (error) {
            throw new Error('Error fetching response code: ' + error.message);
        }
    }

    //Clear all messages from the conversation
    clearMessages() {
        this.messages = [];
    }
}

class OpenAIODI extends Backbone.Controller {
    //Build a controller that has many conversaions available
    constructor() {
        super();
        this.conversations = [];
        this.ready = false;
        this.listenTo(Adapt, 'pageView:postReady', this.onPostReady);
    }

    //Does nothing
    initialize() {
    }

    //Get a config for the plugin, at the moment all conversations hve the config which is weird but ok
    onPostReady() {
        this.config = Adapt.config.get('_openaiodi');
        this.checkAIReady();
    }

    /**
     * Checks if the AI is ready and polls for a valid token.
     * This is a complex method that handles various scenarios to ensure the AI is ready for interaction.
     * @returns {boolean|string} Returns true if the AI is ready, otherwise returns an error message.
     */
    async checkAIReady() {
        // If AI is already ready, return true
        if (this.ready) return true;

        // Create a conversation instance
        const conversation = this.createConversation();
        conversation.addMessage({ role: 'user', content: 'What day is it today?' });

        try {
            // Check if using API URL and not client API key
            if (this.config.apiUrl && !this.config.useClientAPIKey) {
                // Get response code from the conversation
                const responseCode = await conversation.getResponseCode();
                if (responseCode.status === 200) {
                    console.log("AI Ready");
                    // Trigger event indicating AI is ready
                    this.ready = true;
                    Adapt.trigger('openai:ready');
                    // Destroy the conversation
                    this.destroyConversation(conversation);
                    return true;
                } else {
                    // If response code is not 200, throw an error
                    this.destroyConversation(conversation);
                    throw new Error(`Error: ${responseCode.status} ${responseCode.statusText}`);
                }
            }
            // If using client API key and client auth server
            else if (this.config.useClientAPIKey && this.config.clientAuthServer) {
                // Check if API key is provided
                if (this.config.apiKey) {
                    // Get response code from the conversation
                    const responseCode = await conversation.getResponseCode();
                    if (responseCode.status === 200) {
                        console.log("AI Ready");
                        // Trigger event indicating AI is ready
                        this.ready = true;
                        Adapt.trigger('openai:ready');
                        // Store API key locally with expiration date
                        const expirationDate = new Date();
                        expirationDate.setDate(expirationDate.getDate() + 1); // 24 hours from now
                        localStorage.setItem('apiKey', this.config.apiKey);
                        localStorage.setItem('apiKeyExpiration', expirationDate.getTime());
                        // Close overlay
                        this._closeOverlay();
                        // Destroy the conversation
                        this.destroyConversation(conversation);
                        return true;
                    } else {
                        // If response code is not 200, wait for 10 seconds and retry
                        setTimeout(() => {
                            this.checkAIReady();
                        }, 10000);
                    }
                }
                // If API key is not provided and a valid key exists in local storage
                if (!this.config.apiKey && localStorage.getItem('apiKey') && localStorage.getItem('apiKeyExpiration') > Date.now()) {
                    // Check if there's a valid API key stored locally
                    this.config.apiKey = localStorage.getItem('apiKey');
                    // Get response code from the conversation
                    const responseCode = await conversation.getResponseCode();
                    if (responseCode.status === 200) {
                        console.log("AI Ready");
                        // Trigger event indicating AI is ready
                        this.ready = true;
                        Adapt.trigger('openai:ready');
                        // Destroy the conversation
                        this.destroyConversation(conversation);
                        return true;
                    } else {
                        // If response code is not 200, remove invalid API key from local storage
                        localStorage.removeItem('apiKey');
                        localStorage.removeItem('apiKeyExpiration');
                        delete this.config.apiKey;
                    }
                }
                // If API key is not provided or expired, generate a new one and display overlay
                if (!this.config.apiKey) {
                    this.config.apiKey = this._generateGUID();
                    this._displayOverlay();
                    // Destroy the conversation
                    this.destroyConversation(conversation);
                    // Retry after 10 seconds
                    setTimeout(() => {
                        this.checkAIReady();
                    }, 10000);
                }
            } else {
                // If neither API URL nor client API key is provided, throw an error
                this.destroyConversation(conversation);
                throw new Error('Error: 500 Internal Server Error');
            }
        } catch (error) {
            // Log error and return error message
            console.error(error);
            this.destroyConversation(conversation);
            return error.message;
        }
    }

    // Create a new conversation, at the same time call retrieve conversations for this user that are related to a specified contentObjectID
    // This should be split into two functions
    createConversation() {
        const conversation = new Conversation(this.config);
        this.conversations.push(conversation);
        return conversation;
    }

    // Get a specific conversation
    getConversation(id) {
        return this.conversations.find(conversation => conversation.id === id);
    }

    // Destroy a conversation (client side only), mainly used for testing AI is ready
    destroyConversation(conversation) {
        const index = this.conversations.indexOf(conversation);
        if (index !== -1) {
            this.conversations.splice(index, 1);
        }
    }

    // Get all conversations stored locally
    getConversations() {
        return this.conversations;
    }

    // Retrieve conversaions from the server, calls a trigger when done.
    async retrieveConversations(contentObjectId) {
        if (!this.config.clientAuthServer || !this.ready) {
            return;
        }
        try {
            const response = await fetch(this.config.clientAuthServer + "/conversations?contentObjectId=" + contentObjectId, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + this.config.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Error: ' + response.status + ' ' + response.statusText);
            }

            const conversations = await response.json();
            conversations.forEach(conversationData => {
                const id = conversationData._id;

                // Check if the conversation with the same ID already exists
                const existingConversation = this.conversations.find(conversation => conversation.id === id);
                if (!existingConversation) {
                    const messages = conversationData.history.map(entry => ({
                        role: entry.message.role,
                        content: entry.message.content,
                        _id: entry._id || null,
                        rating: entry.rating || null
                    }));

                    const conversation = new Conversation(this.config);
                    conversation.id = id;
                    conversation.messages = messages;
                    //load all the other parameters here

                    this.conversations.push(conversation);
                }
            });
            Adapt.trigger('openai:conversationsUpdated',this.conversations);

        } catch (error) {
            throw new Error('Error fetching conversations: ' + error.message);
        }
    }

    // Generate a GUID to use as the user Token
    _generateGUID() {
        // Function to generate a GUID
        const s4 = () => {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        };

        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
               s4() + '-' + s4() + s4() + s4();
    }

    // Display login window overlay
    _displayOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.id = '_openaiodi_overlay'; // Set the ID of the overlay element
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '9999';

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#fff';
        closeButton.style.border = '1px solid #000';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';

        closeButton.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        const iframe = document.createElement('iframe');
        iframe.src = `${this.config.clientAuthServer}?accessToken=${this.config.apiKey}`;
        iframe.style.position = 'absolute';
        iframe.style.top = '50%';
        iframe.style.left = '50%';
        iframe.style.transform = 'translate(-50%, -50%)';
        iframe.style.width = '800px';
        iframe.style.height = '400px';
        iframe.style.border = 'none';

        overlay.appendChild(closeButton);
        overlay.appendChild(iframe);
        document.body.appendChild(overlay);
    }

    // Close login window overlay
    _closeOverlay() {
        const overlay = document.getElementById('_openaiodi_overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    }

}

Adapt.openaiodi = new OpenAIODI();

export default Adapt.openaiodi;