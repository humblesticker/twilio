// 
// handle inline-hook request from Okta
//
exports.handler = function(context, event, callback) {
  console.log(context, event);
  const authHeader = event.request.headers.authorization;
  if(authenticated(authHeader, context.API_KEY, context.API_SECRET) === false)
    return callback(null, setUnauthorized());

  // get to and code from event (okta)
  const messageProfile = event.data.messageProfile;
  const channel = messageProfile.deliveryChannel.toLowerCase();
  const to = messageProfile.phoneNumber, code = messageProfile.otpCode;
  console.log(channel, to, code);

  const twilioClient = context.getTwilioClient();
  if(channel === 'sms') { 
    const request = twilioClient.messages.create({ from: context.MESSAGE_SERVICE_ID, to, body: getMessageBody(code) }); 
    sendOtp(request, channel, callback);
  } else if(channel === 'voice call') {
    const oneByOne = String(code).split('').join('. '); // with . and space char, number will be read one by one
    const from = getPhonenumber(context.VOICE_PHONENUMBERS.split(','));
    const request = twilioClient.calls.create({ from, to, twiml: getVoiceXML(oneByOne)});
    sendOtp(request, channel, callback);
  } else return callback(oktaResponse("FAILURE", "", `${channel} is not supported`));
};

// Make sure to only call `callback` once everything is finished
// pass null as the first parameter to signal successful execution
const sendOtp = (request, channel, callback) => {
  request.then((message) => {
      console.log(`OTP successfully sent via ${channel}: ${message.sid}`);
      return callback(null, oktaResponse("SUCCESSFUL", message.sid, channel));
    })
    .catch((error) => {
      console.error(error.message, error.code);
      return callback(oktaResponse("FAILURE", "", `${error.code}:${error.message}`));
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
        value: [{ status, provider: "Twilio", transactionId, transactionMetadata
        }],
      }]
  };
};

const getPhonenumber = (numbers) => {
  const index = Math.floor(Math.random() * numbers.length);
  return numbers[index];
};

const getMessageBody = (code) => {
  return `DO NOT SHARE YOUR OCCU CODE: ${code}. We NEVER ask you to verbally verify this code. If someone asks for this code it is a scam. Report fraud to 888-354-6228`;
};

const getVoiceXML = (code) => {
  return `<Response><Pause length="2"/><Say>Hello! Thank you for using our phone verification system. Your code is ${code}. Once again, your code is ${code}. Good bye!</Say></Response>`;
};
