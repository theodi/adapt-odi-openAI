# Adapt OpenAI Extension

This Adapt extension allows integration with OpenAI's conversational AI API to enable interactive conversations within your Adapt courses. Note that you can use it with any Chat AI that implements the OpenAI conversation API.

## Installation

### Via Authoring Tool

1. Install the plugin via the plugin management interface

### Into framework

1. Clone or download the repository to your local machine.
2. Copy the `adapt-odi-openAI` folder to your Adapt project's `src/extensions/` directory.

## Configuration

Before using the extension, you need to configure it with your OpenAI API key and other settings. Configuration can be done via the Adapt authoring tool or directly in the code.

### Via Adapt Authoring Tool

1. In the Adapt authoring tool, navigate to configuration settings of the course
2. Find the OpenAI API extension settings.
3. Enter your OpenAI API endpoint and other necessary settings.

### Directly in config.json

Alternatively, you can configure the extension directly in your course's `config.json` file. Here's an example configuration:

```json
"_openaiodi": {
    "apiUrl": "https://api.openai.com/v1/completions",
    "apiKey": "your_api_key_here",
    "_testMode": false,
    "_testModeResponse": "Hello, I'm not an AI but the answer you are looking for is 42!",
    "model": "gpt-3.5-turbo",
    "temperature": 0.7,
    "max_tokens": 150,
    "topP": 1.0,
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "n": 1,
    "stop": ["\n", ""]
}
```

## WARNING

Remember: Adapt outputs and code is all client side executed. This includes any apiKeys! So any user could easily find the API key in your config file. Also if you put the output source code on a public server, then anyone can find the API Key! If you are using OpenAI, they will mostly likely detect the key and instantly revoke it as you have been stoopid.

You should consider using a proxy or deploying the package into an LMS where only limited trusted individuals have access.

## Usage

Once the extension is installed and configured, you can use it to create interactive conversations within your Adapt courses. Here's how you can use it:

1. Create a new instance of the conversation:

```javascript
const conversation = Adapt.openaiodi.createConversation();
```

2. Add messages to the conversation using the `addMessage` method:

```javascript
conversation.addMessage({ role: 'user', content: 'Hello!' });
```

3. Get a response from the AI using the `getResponse` method:

```javascript
conversation.getResponse()
    .then(response => {
        console.log('AI Response:', response);
    })
    .catch(error => {
        console.error('Error fetching response:', error.message);
    });
```

4. Clear messages from the conversation when needed:

```javascript
conversation.clearMessages();
```

## Testing

You can test the functionality of the extension by enabling test mode in the configuration and providing test responses. This allows you to simulate interactions without making actual API.

## License

This project is licensed under the [MIT License](LICENSE).

```

Feel free to modify the content according to your specific requirements or add any additional information you find relevant.