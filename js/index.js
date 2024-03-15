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
                throw new Error('The AI assistant encountered the following error: ' + errorData.error.code + ' - ' + errorData.error.message);
            }

            const responseData = await response.json();
            return responseData.choices[0].message.content;
        } catch (error) {
            throw new Error('Error fetching response: ' + error.message);
        }
    }

    clearMessages() {
        this.messages = [];
    }
}

class OpenAIODI extends Backbone.Controller {
    initialize() {
    }

    createConversation() {
        this.config = Adapt.config.get('_openaiodi');
        return new Conversation(this.config);
    }
}

Adapt.openaiodi = new OpenAIODI();

export default Adapt.openaiodi;