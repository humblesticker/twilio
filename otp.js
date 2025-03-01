// 
// handle inline-hook request from Okta
//
exports.handler = function(context, event, callback) {
   // You can log with console.log
  console.log('context', context);
  console.log('event', event);

  const authHeader = event.request.headers.authorization;
  if(authenticated(authHeader, context.API_KEY, context.API_SECRET) === false)
    return callback(null, setUnauthorized());

  // get to and code from event (okta)
  const messageProfile = event.data.messageProfile;
  const channel = messageProfile.deliveryChannel.toLowerCase();
  console.log('channel', channel);
  
  const twilioClient = context.getTwilioClient();
  sendVoice(twilioClient, context.FROM, messageProfile.phoneNumber, messageProfile.otpCode, callback);
};

const sendVoice = (twilioClient, from, to, code, callback) => {
  // one number at a time
  code = String(code).split('').join('. ');
  console.log(code);

  twilioClient.calls
    .create({ from: "+17149420727", to, twiml: createVoiceXML(code)})
    .then((message) => {
      console.log('SMS successfully sent');
      console.log(message.sid);
      // Make sure to only call `callback` once everything is finished, and to pass
      // null as the first parameter to signal successful execution.
      return callback(null, oktaResponse("SUCCESSFUL", message.sid, ""));
    })
    .catch((error) => {
      console.error(error);
      return callback(oktaResponse("FAILURE", "", ""));
    });
};

const sendSms = (twilioClient, from, to, code, callback) => {
  const body = 'otp:' + code;

  // Use `messages.create` to generate a message. Be sure to chain with `then`
  // and `catch` to properly handle the promise and call `callback` _after_ the
  // message is sent successfully!
  twilioClient.messages
    .create({ from, to, body })
    .then((message) => {
      console.log('SMS successfully sent');
      console.log(message.sid);
      // Make sure to only call `callback` once everything is finished, and to pass
      // null as the first parameter to signal successful execution.
      return callback(null, oktaResponse("SUCCESSFUL", message.sid, ""));
    })
    .catch((error) => {
      console.error(error);
      return callback(oktaResponse("FAILURE", "", ""));
    });
};

const authenticated = (authHeader, API_KEY, API_SECRET) => {
  if (!authHeader) return false;

  const [authType, credentials] = authHeader.split(' ');
  if (authType.toLowerCase() !== 'basic') return false

  const [apiKey, apiSecret] = Buffer.from(credentials, 'base64').toString().split(':');
  if (apiKey !== API_KEY || apiSecret !== API_SECRET) return false;

  return true;
};

const setUnauthorized = () => {
  const response = new Twilio.Response();
  response.setBody('Unauthorized - you are not authenticated to perform this request').setStatusCode(401);
  return response;
};

const oktaResponse = (status, transactionId, transactionMetadata) => {
  return {
      commands: [{
        type: "com.okta.telephony.action",
        value: [{
          status,
          provider: "Twilio",
          transactionId,
          transactionMetadata
        }],
      }]
  };
};

const createVoiceXML = (code) => {
  return `<Response><Pause length="2"/><Say>Your code is ${code}. Once again, your code is ${code}</Say></Response>`;
};
