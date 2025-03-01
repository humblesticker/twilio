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
  } else if(channel === 'voice') {
    const oneByOne = String(code).split('').join('. '); // with . and space char, number will be read one by one
    const request = twilioClient.calls.create({ from: context.VOICE_PHONENUMBER, to, twiml: getVoiceXML(oneByOne)});
    sendOtp(request, channel, callback);
  } else return callback(oktaResponse("FAILURE", "", `${channel} is not supported`));
};

// Make sure to only call `callback` once everything is finished
// pass null as the first parameter to signal successful execution
const sendOtp = (request, channel, callback) => {
  request.then((message) => {
      console.log(`OTP successfully sent via ${channel}: ${message.sid}`);
      return callback(null, oktaResponse("SUCCESSFUL", message.sid, ""));
    })
    .catch((error) => {
      console.error(error);
      return callback(oktaResponse("FAILURE", "", error));
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

const getMessageBody = (code) => {
  return `DO NOT SHARE YOUR OCCU CODE: ${code}. We NEVER ask you to verbally verify this code. If someone asks for this code it is a scam. Report fraud to 888-354-6228`;
};

const getVoiceXML = (code) => {
  return `<Response><Pause length="2"/><Say>Your code is ${code}. Once again, your code is ${code}</Say></Response>`;
};
