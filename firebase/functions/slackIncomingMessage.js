const admin = require('firebase-admin');
const deAsync = require('deasync');
const emoji = require('node-emoji');
const functions = require('firebase-functions');
const request = require('request');


module.exports = functions.https.onRequest((req, res) => {
    console.log(req.body);

    // Init
    const db = admin.firestore();
    const chromeCastRef = db.collection('huge_cast').doc('cast_1');
    res.setHeader('Content-Type', 'application/json');

    // Auth
    let x = isAuthorized(db, req.body.token);
    if (!x){
        let payload = {
            text: "Invalid Source."
        };
        res.send(JSON.stringify(payload, null, 4));
        return
    } else {
        // Response
        let data = processRequest(req.body.text);
        let text = getResponseText(data.type, req.body.user_name);
        let payload = {
            text: text
        };
        // Update Database
        res.send(JSON.stringify(payload, null, 4));
        chromeCastRef.set(data);
    }
});


function isAuthorized(db, token) {
    let isAuth;

    const slackRef = db.collection('config').doc('slack');
    slackRef.get()
        .then(doc => {
            if (!doc.exists || !doc.data() || !doc.data().tokens) {
                isAuth = true;
            } else if (doc.data().tokens.indexOf(token) > -1) {
                isAuth = true;
            } else {
                console.warn('Invalid Source.');
                isAuth = false
            }
            return null
        })
        .catch(err => {
            console.warn('Error getting document', err);
            isAuth = false;
        });

    while(isAuth === undefined) deAsync.sleep(100);
    return isAuth;
}


function processRequest(message) {
    let content_type = getContentType(message);

    if (content_type === 'text') {
        message = emoji.emojify(message);
    }

    return {
        value: message,
        type: content_type
    };
}


function isImage(url){
    /*
        Checks a resources file signature
     */
    const magic = {
        bmp: '424d',
        jpg: 'ffd8ff',
        png: '89504e47',
        gif: '47494638',
        tif: '49492a00',
        webp: '52494646'
    };
    const options = {
        method: 'GET',
        url: url,
        encoding: null // keeps the body as buffer
    };

    let isImage;
    request(options, (err, response, body) => {
        if(!err && response.statusCode === 200){
            const magigNumberInBody = body.toString('hex', 0, 4);
            if (magigNumberInBody.startsWith(magic.jpg) ||
                magigNumberInBody.startsWith(magic.bmp) ||
                magigNumberInBody === magic.png ||
                magigNumberInBody === magic.tif ||
                magigNumberInBody === magic.webp ||
                magigNumberInBody === magic.gif) {

                isImage = true;
                return null
            }
        }
        isImage = false;
        return null
    });

    while(isImage === undefined) deAsync.sleep(200);
    return isImage;
}


function getContentType(value){
    const pattern = "(ftp|http|https):\\/\\/(\\w+:{0,1}\\w*@)?(\\S+)(:[0-9]+)?(\\/|\\/([\\w#!:.?+=&%@!\\-\\/]))?";
    const re = new RegExp(pattern);
    const imageTypes= ['jpeg', 'jpg', 'gif', 'png', 'bmp'];
    const videoTypes= ['mp4'];

    if (re.exec(value) && value.indexOf('.') > -1) {
        const ext = value.split('.').pop().toLowerCase();
        if (imageTypes.indexOf(ext) > -1) return "image";
        if (videoTypes.indexOf(ext) > -1) return "video";
        if (isImage(value)) {
            return "image";
        }
    }
    return "text"
}


function getResponseText(content_type, user_name) {
    const generalArray = [
        `Good choice ${user_name}!`,
        'Do I really have to share that with everyone....fine',
        `Look at ${user_name}, causing some trouble`,
        `I'm taking credit for this.`,
        `${user_name} always has the best posts.`,
        `:thinking_face: Yes yes, of course.`,
    ];

    const textArray = [
        `Is that a spelling error? Just kidding ${user_name}!`,
        `Spoken like a true word smith.`,
    ];
    const imageArray = [
        `A work of art. :)`,
        `I'm hanging this picture on the fridge.`,
        `:camera: That's going in the slide show.`,
    ];

    const videoArray = [
        `*Grabs Popcorn*`,
        `I couldn't find a loading animation so get you some dots ........`,
        `:film_projector:`,
    ];

    let resp = generalArray;
    if (content_type === 'text') resp = generalArray.concat(textArray);
    if (content_type === 'image') resp = generalArray.concat(imageArray);
    if (content_type === 'video') resp = generalArray.concat(videoArray);

    const i = Math.floor(Math.random()*resp.length);
    return resp[i]

}
