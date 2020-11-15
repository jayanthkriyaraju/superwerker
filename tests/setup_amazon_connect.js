var synthetics = require('Synthetics');
const AWS = require("aws-sdk");

const LOG = require('SyntheticsLogger');
const url = require('url');
const fs = require('fs');

const CONNECT_SSM_PARAMETER = '/superwerker/tests/connect'
const ACCOUNTID = '215867065708'
const AWS_CONNECT_REGION = 'us-east-1'
AWS.config.update({region: AWS_CONNECT_REGION});

const domain = 'superwerker-tests'


const httpGet = url => {
    const https = require('https');
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            res.setEncoding('utf8');
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
};

const flowBuilderBlueprint = async function () {
    let page = await synthetics.getPage();

    await synthetics.executeStep('consoleLogin', async function () {

        const federationEndpoint = 'https://signin.aws.amazon.com/federation';
        const issuer = 'superwerker';
        const destination = 'https://console.aws.amazon.com/';

        let credentials = await AWS.config.credentialProvider.resolve((err, cred) => { return cred; }).resolvePromise()

        const session = {
            sessionId: credentials.accessKeyId,
            sessionKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken
        };

        const encodedSession = encodeURIComponent(JSON.stringify(session));
        const signinTokenUrl = `${federationEndpoint}?Action=getSigninToken&SessionDuration=3600&Session=${encodedSession}`;

        const signinResponse = await httpGet(signinTokenUrl);

        let consoleLoginUrl = `${federationEndpoint}?Action=login&Issuer=${issuer}&Destination=${destination}&SigninToken=${
            JSON.parse(signinResponse).SigninToken
        }`;

        await page.goto(consoleLoginUrl, {waitUntil: ['load', 'networkidle0']});

    });

    await synthetics.executeStep('setupAmazonConnect', async function () {

        // await createinstance(page, {
        //     'Domain': domain
        // });
        const instanceId =  await open(page, {
            'Domain': domain
        });
        console.log(instanceId)
        let hostx = new url.URL(await page.url()).host;
        while (hostx.indexOf('awsapps') == -1) {
            await page.waitFor(20000);
            await open(page, {
                'Domain': domain
            });
            hostx = new url.URL(await page.url()).host;
        }
        let prompts = await uploadprompts(page, {
            'Domain': domain
        });
        await createflow(
            page,
            instanceId, {
               'Domain': domain
            },
            prompts
        );

        let number = await claimnumber(page, {
            'Domain': domain
        });
        LOG.info("Registered phone number: " + number['PhoneNumber']);

        let variables = {};

        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(num => {
            variables['PROMPT_' + num] = prompts[num + '.wav'];
        });
        variables['PHONE_NUMBER'] = number['PhoneNumber'].replace(/[ -]/g, "")

        const ssm = new AWS.SSM();
        await ssm.putParameter({
            Name: CONNECT_SSM_PARAMETER,
            Type: "String",
            Value: JSON.stringify(variables),
            Overwrite: true
        }).promise();


    });
};



exports.handler = async () => {
    return await flowBuilderBlueprint();
};


async function createinstance(page, properties) {
    await page.goto('https://' + AWS_CONNECT_REGION + '.console.aws.amazon.com/connect/onboarding', {
        timeout: 0,
        waitUntil: ['domcontentloaded']
    });

    let directory = await page.$('input[ng-model="ad.directoryAlias"]');
    await directory.press('Backspace');
    await directory.type(properties.Domain, { delay: 100 });

    // await page.waitFor(2000);
    // const submit_button = await  page.$('#c > div > div > div > div.onboarding-main-pane > div > div.onboarding-main-pane-footer > span:nth-child(3) > awsui-button > button > span');
    // submit_button.scrollIntoView();

    // somehow it seems we need to scroll to the button to click it
    page.$eval('#c > div > div > div > div.onboarding-main-pane > div > div.onboarding-main-pane-footer > span:nth-child(3) > awsui-button > button > span', (el) => el.scrollIntoView())


    await page.click('#c > div > div > div > div.onboarding-main-pane > div > div.onboarding-main-pane-footer > span:nth-child(3) > awsui-button > button > span');

    await page.waitForSelector('label.vertical-padding.option-label');
    await page.waitFor(200);
    let skipradio = await page.$$('label.vertical-padding.option-label');
    skipradio.pop().click();

    await page.waitFor(200);

    await page.click('button[type="submit"].awsui-button-variant-primary');

    await page.waitFor(200);

    await page.click('button[type="submit"].awsui-button-variant-primary');

    await page.waitFor(200);

    await page.click('button[type="submit"].awsui-button-variant-primary');

    await page.waitFor(200);

    await page.click('button[type="submit"].awsui-button-variant-primary');

    await page.waitFor(200);

    await page.click('button[type="submit"].awsui-button-variant-primary');

    await page.waitForSelector('.onboarding-success-message', {timeout: 180000});

    await page.waitFor(3000);
}

async function open(page, properties) {
    await page.goto('https://' + AWS_CONNECT_REGION + '.console.aws.amazon.com/connect/home', {
        timeout: 0,
        waitUntil: ['domcontentloaded']
    });
    await page.waitFor(3000);
    const instanceId = (await page.evaluate(
        anchor => anchor.getAttribute('href'),
        await page.$('table > tbody > tr > td:nth-child(1) > div > a')
    )).split('/')[1];

    await page.click('table > tbody > tr > td:nth-child(1) > div > a');

    await page.waitFor(5000);

    let loginbutton = await page.$('a[ng-show="org.organizationId"]');
    let loginlink = await page.evaluate((obj) => {
        return obj.getAttribute('href');
    }, loginbutton);

    await page.goto('https://' + AWS_CONNECT_REGION + '.console.aws.amazon.com' + loginlink, {
        timeout: 0,
        waitUntil: ['domcontentloaded']
    });

    await page.waitFor(8000);

    return instanceId
}

async function claimnumber(page, properties) {
    let host = 'https://' + new url.URL(await page.url()).host;

    LOG.debug(host + '/connect/numbers/claim');

    await page.goto(host + '/connect/numbers/claim', {
        timeout: 0,
        waitUntil: ['domcontentloaded']
    });
    await page.waitFor(5000);

    

    await page.waitFor(3000);

    await page.click('li[heading="DID (Direct Inward Dialing)"] > a');

    await page.waitFor(200);

    await page.click('div.active > span > div.country-code-real-input');

    await page.waitFor(200);

    await page.click('div.active > span.country-code-input.ng-scope > ul > li > .us-flag'); // USA

    await page.waitFor(5000);

    await page.click('div.active > awsui-radio-group > div > span > div:nth-child(1) > awsui-radio-button > label.awsui-radio-button-wrapper-label > div'); // Phone number selection

    let phonenumber = await page.$('div.active > awsui-radio-group > div > span > div:nth-child(1) > awsui-radio-button > label.awsui-radio-button-checked.awsui-radio-button-label > div > span > div');
    let phonenumbertext = await page.evaluate(el => el.textContent, phonenumber);

    await page.waitFor(200);

    

    let disclaimerlink = await page.$('div.tab-pane.ng-scope.active > div.alert.alert-warning.ng-scope > a');
    if (disclaimerlink !== null) {
        disclaimerlink.click();
    }

    await page.waitFor(200);

    

    await page.click('#s2id_select-width > a');

    await page.waitFor(2000);

    

    let s2input = await page.$('#select2-drop > div > input');
    await s2input.press('Backspace');
    await s2input.type("myFlow", { delay: 100 });
    await page.waitFor(2000);
    await s2input.press('Enter');
    await page.waitFor(1000);

    

    await page.click('awsui-button[text="Save"] > button');
    await page.waitFor(5000);

    

    return {
        'PhoneNumber': phonenumbertext
    };
}

const httpGetBinary = url => {
    const https = require('https');
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            //res.setEncoding('binary');
            var data = [ ];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
};

async function uploadprompts(page, properties) {
    let host = 'https://' + new url.URL(await page.url()).host;

    let ret = {};

    let prompt_filenames = [
        'a-10-second-silence.wav',
        '9.wav',
        '8.wav',
        '7.wav',
        '6.wav',
        '5.wav',
        '4.wav',
        '3.wav',
        '2.wav',
        '1.wav',
        '0.wav'
    ];

    for (var pid in prompt_filenames) {
        let filename = prompt_filenames[pid];

        let tmp_location = fs.mkdtempSync('prompts');
        let download_location = 'https://raw.githubusercontent.com/iann0036/aws-account-controller/master/lambda/prompts/' + filename;

        image_content = await httpGetBinary(download_location).then(res => {
            fs.writeFileSync(tmp_location + '/' + filename, res);
        });

        do {
            await page.goto(host + "/connect/prompts/create", {
                timeout: 0,
                waitUntil: ['domcontentloaded']
            });
            await page.waitFor(5000);
            LOG.info("Checking for correct load");
            LOG.debug(host + "/connect/prompts/create");
        } while (await page.$('#uploadFileBox') === null);

        const fileInput = await page.$('#uploadFileBox');
        await fileInput.uploadFile(tmp_location + '/' + filename);

        await page.waitFor(1000);

        let input1 = await page.$('#name');
        await input1.click({ clickCount: 3 }) // select everything to overwrite it by typing


        await page.waitFor(1000);
        await input1.type(filename, { delay: 100 });

        await page.waitFor(1000);

        await page.click('#lily-save-resource-button');

        await page.waitFor(8000);

        

        await page.$('#collapsePrompt0 > div > div:nth-child(2) > table > tbody > tr > td');
        let promptid = await page.$eval('#collapsePrompt0 > div > div:nth-child(2) > table > tbody > tr > td', el => el.textContent);
        LOG.debug("PROMPT ID:");
        LOG.debug(promptid);
        ret[filename] = promptid;
    };

    

    return ret;
}

async function createflow(page, instanceId, properties, prompts) {

    let flow = `{
  "Version": "2019-10-30",
  "StartAction": "e30d63b7-e7d5-42df-9dea-f93e0bed321d",
  "Metadata": {
    "entryPointPosition": {
      "x": 24,
      "y": 17
    },
    "snapToGrid": false,
    "ActionMetadata": {
      "a238d7ff-9df4-481b-bcf5-e472c3a51abf": {
        "position": {
          "x": 700,
          "y": 16
        },
        "useDynamic": true
      },
      "1f4d3616-77cc-4cef-8881-949c531e13ce": {
        "position": {
          "x": 456,
          "y": 19
        },
        "useDynamic": true
      },
      "39ca9b44-c416-45eb-b2c0-591956bd2fe9": {
        "position": {
          "x": 948,
          "y": 18
        },
        "useDynamic": true
      },
      "ad3b6726-dfed-40fe-b4c7-95a9751fc4a7": {
        "position": {
          "x": 191,
          "y": 15
        },
        "dynamicMetadata": {},
        "useDynamic": false
      },
      "e30d63b7-e7d5-42df-9dea-f93e0bed321d": {
        "position": {
          "x": 120,
          "y": 242
        },
        "useDynamic": false,
        "promptName": "a-10-second-silence.waa-10-second-silence.wav"
      },
      "f5205242-eeb0-4b71-bb47-f8c2adf848fa": {
        "position": {
          "x": 1442,
          "y": 22
        }
      },
      "406812d0-65de-4f5a-ba33-89c450b94238": {
        "position": {
          "x": 1198,
          "y": 17
        },
        "useDynamic": true
      },
      "2298a0bd-cb66-4476-b1cb-1680a079eca6": {
        "position": {
          "x": 1395,
          "y": 268
        },
        "useDynamic": false,
        "promptName": "a-10-second-silence.waa-10-second-silence.wav"
      }
    }
  },
  "Actions": [
    {
      "Identifier": "a238d7ff-9df4-481b-bcf5-e472c3a51abf",
      "Parameters": {
        "PromptId": "$.External.prompt2"
      },
      "Transitions": {
        "NextAction": "39ca9b44-c416-45eb-b2c0-591956bd2fe9",
        "Errors": [],
        "Conditions": []
      },
      "Type": "MessageParticipant"
    },
    {
      "Identifier": "1f4d3616-77cc-4cef-8881-949c531e13ce",
      "Parameters": {
        "PromptId": "$.External.prompt1"
      },
      "Transitions": {
        "NextAction": "a238d7ff-9df4-481b-bcf5-e472c3a51abf",
        "Errors": [],
        "Conditions": []
      },
      "Type": "MessageParticipant"
    },
    {
      "Identifier": "39ca9b44-c416-45eb-b2c0-591956bd2fe9",
      "Parameters": {
        "PromptId": "$.External.prompt3"
      },
      "Transitions": {
        "NextAction": "406812d0-65de-4f5a-ba33-89c450b94238",
        "Errors": [],
        "Conditions": []
      },
      "Type": "MessageParticipant"
    },
    {
      "Identifier": "ad3b6726-dfed-40fe-b4c7-95a9751fc4a7",
      "Parameters": {
        "LambdaFunctionARN": "arn:aws:lambda:us-east-1:${ACCOUNTID}:function:AccountAutomator",
        "InvocationTimeLimitSeconds": "8"
      },
      "Transitions": {
        "NextAction": "1f4d3616-77cc-4cef-8881-949c531e13ce",
        "Errors": [
          {
            "NextAction": "f5205242-eeb0-4b71-bb47-f8c2adf848fa",
            "ErrorType": "NoMatchingError"
          }
        ],
        "Conditions": []
      },
      "Type": "InvokeLambdaFunction"
    },
    {
      "Identifier": "e30d63b7-e7d5-42df-9dea-f93e0bed321d",
      "Parameters": {
        "PromptId": "${prompts['a-10-second-silence.wav']}"
      },
      "Transitions": {
        "NextAction": "ad3b6726-dfed-40fe-b4c7-95a9751fc4a7",
        "Errors": [],
        "Conditions": []
      },
      "Type": "MessageParticipant"
    },
    {
      "Identifier": "f5205242-eeb0-4b71-bb47-f8c2adf848fa",
      "Type": "DisconnectParticipant",
      "Parameters": {},
      "Transitions": {}
    },
    {
      "Identifier": "406812d0-65de-4f5a-ba33-89c450b94238",
      "Parameters": {
        "PromptId": "$.External.prompt4"
      },
      "Transitions": {
        "NextAction": "2298a0bd-cb66-4476-b1cb-1680a079eca6",
        "Errors": [],
        "Conditions": []
      },
      "Type": "MessageParticipant"
    },
    {
      "Identifier": "2298a0bd-cb66-4476-b1cb-1680a079eca6",
      "Parameters": {
        "PromptId": "${prompts['a-10-second-silence.wav']}"
      },
      "Transitions": {
        "NextAction": "f5205242-eeb0-4b71-bb47-f8c2adf848fa",
        "Errors": [],
        "Conditions": []
      },
      "Type": "MessageParticipant"
    }
  ]
}
`;
    console.log(instanceId)
    const connect = new AWS.Connect();
    await connect.createContactFlow({
        InstanceId:  instanceId,
        Content: flow,
        Type: 'CONTACT_FLOW',
        Name: 'myFlow',
    }).promise()

}