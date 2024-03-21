import Adapt from 'core/js/adapt';

class Conversation {
    constructor(config) {
        this.messages = [];
        this.config = config;
    }

    addMessage(message) {
        this.messages.push(message);
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
        this.listenTo(Adapt, 'pageView:postReady', this.checkAIReady);
    }

    initialize() {
    }

    async checkAIReady() {
        if (this.AIReady) return true;

        const conversation = this.createConversation();
        conversation.addMessage({ role: 'user', content: 'What day is it today?' })

        try {
            if (this.config.apiUrl && !this.config.useDynamicToken) {
                const responseCode = await conversation.getResponseCode();
                if (responseCode.status === 200) {
                    console.log("AI Ready");
                    this.destroyConversation(conversation);
                    return true;
                } else {
                    this.destroyConversation(conversation);
                    throw new Error(`Error: ${responseCode.status} ${responseCode.statusText}`);
                }
            } else if (this.config.useClientAPIKey && this.config.clientAuthServer) {
                this.destroyConversation(conversation);
                throw new Error('Error: 401 Authorization Required');
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

    createConversation() {
        this.config = Adapt.config.get('_openaiodi');
        const conversation = new Conversation(this.config);
        this.conversations.push(conversation);
        return conversation;
    }

    destroyConversation(conversation) {
        const index = this.conversations.indexOf(conversation);
        if (index !== -1) {
            this.conversations.splice(index, 1);
        }
    }
}

Adapt.openaiodi = new OpenAIODI();

export default Adapt.openaiodi;