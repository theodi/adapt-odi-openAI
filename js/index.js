import Adapt from 'core/js/adapt';

class Conversation {
    constructor(config) {
        this.messages = [];
        this.config = config;
        this.currentBlock = {};
    }

    addMessage(message) {
        this.messages.push(message);
    }

    setCurrentBlock(block) {
        this.currentBlock = block;
    }

    async setConversationID(contentObjectId) {
        const _courseId = Adapt.config.get("_courseId");
        const programmeData = Adapt.course.get("_skillsFramework") || null;
        let _skillsFramework = {};
        if (programmeData && programmeData._items[0]) {
            _skillsFramework.programmeUri = programmeData._items[0].uri;
            _skillsFramework.programmeTitle = programmeData._items[0].title;
        }

        // Do nothing if not using a proxy
        if (!this.config.clientAuthServer) {
            return;
        }

        const apiKey = this.config.apiKey;
        const apiUrl = this.config.apiUrl;

        const body = {
            contentObjectId: contentObjectId,
            courseId: _courseId,
            _skillsFramework: _skillsFramework
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

        const apiKey = this.config.apiKey;
        var apiUrl = this.config.apiUrl;

        const body = {
            model: this.config.model,
            messages: this.messages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            n: 1,
            stop: this.config.stop
        }

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
            return responseData.choices[0].message.content;
        } catch (error) {
            throw new Error('Error fetching response: ' + error.message);
        }
    }

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

    clearMessages() {
        this.messages = [];
    }
}

class OpenAIODI extends Backbone.Controller {
    constructor() {
        super();
        this.conversations = [];
        this.ready = false;
        this.listenTo(Adapt, 'pageView:postReady', this.onPostReady);
    }

    initialize() {
    }

    onPostReady() {
        this.config = Adapt.config.get('_openaiodi');
        this.checkAIReady();
    }

    async checkAIReady() {
        if (this.ready) return true;
        console.log('checking AI Ready');
        const conversation = this.createConversation();
        conversation.addMessage({ role: 'user', content: 'What day is it today?' })

        try {
            if (this.config.apiUrl && !this.config.useClientAPIKey) {
                const responseCode = await conversation.getResponseCode();
                if (responseCode.status === 200) {
                    console.log("AI Ready");
                    this.ready = true;
                    Adapt.trigger('openai:ready');
                    this.destroyConversation(conversation);
                    return true;
                } else {
                    this.destroyConversation(conversation);
                    throw new Error(`Error: ${responseCode.status} ${responseCode.statusText}`);
                }
            } else if (this.config.useClientAPIKey && this.config.clientAuthServer) {
                if (this.config.apiKey) {
                    const responseCode = await conversation.getResponseCode();
                    if (responseCode.status === 200) {
                        console.log("AI Ready");
                        this.ready = true;
                        Adapt.trigger('openai:ready');
                        // Store API key locally with expiration date
                        const expirationDate = new Date();
                        expirationDate.setDate(expirationDate.getDate() + 1); // 24 hours from now
                        localStorage.setItem('apiKey', this.config.apiKey);
                        localStorage.setItem('apiKeyExpiration', expirationDate.getTime());
                        this._closeOverlay();
                        this.destroyConversation(conversation);
                        return true;
                    } else {
                        setTimeout(() => {
                            this.checkAIReady();
                        }, 10000);
                    }
                }
                if (!this.config.apiKey && localStorage.getItem('apiKey') && localStorage.getItem('apiKeyExpiration') > Date.now()) {
                    // Check if there's a valid API key stored locally
                    this.config.apiKey = localStorage.getItem('apiKey');
                    const responseCode = await conversation.getResponseCode();
                    if (responseCode.status === 200) {
                        console.log("AI Ready");
                        this.ready = true;
                        Adapt.trigger('openai:ready');
                        this.destroyConversation(conversation);
                        return true;
                    } else {
                        // If the stored API key is invalid, remove it from local storage
                        localStorage.removeItem('apiKey');
                        localStorage.removeItem('apiKeyExpiration');
                        delete this.config.apiKey;
                    }
                }
                if (!this.config.apiKey) {
                    this.config.apiKey = this._generateGUID();
                    this._displayOverlay();
                    this.destroyConversation(conversation);
                    setTimeout(() => {
                        this.checkAIReady();
                    }, 10000);
                }
            } else {
                this.destroyConversation(conversation);
                throw new Error('Error: 500 Internal Server Error');
            }
        } catch (error) {
            console.error(error);
            this.destroyConversation(conversation);
            return error.message;
        }
    }

    createConversation(contentObjectID) {
        const conversation = new Conversation(this.config);
        this.conversations.push(conversation);
        if (this.ready) {
            conversation.setConversationID(contentObjectID);
        }
        return conversation;
    }

    destroyConversation(conversation) {
        const index = this.conversations.indexOf(conversation);
        if (index !== -1) {
            this.conversations.splice(index, 1);
        }
    }

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

    _closeOverlay() {
        const overlay = document.getElementById('_openaiodi_overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    }

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

}

Adapt.openaiodi = new OpenAIODI();

export default Adapt.openaiodi;