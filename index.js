const Koa = require("koa");
const app = new Koa();

const ImageScript = require("imagescript");
const { request } = require("undici");

/**
 * Credit: https://stackoverflow.com/a/3983830
 * @param {number[]} probas List of percentages in decimal form, must be summed up to 1
 * @returns 
 */
let randexec = (probas=[0.3, 0.3, 0.4]) => {
   let ar = []; let sum = 0;

   probas = [0, ...probas];

   for (let i = 0; i < probas.length - 1; i++) {
       sum += probas[i];
       ar[i] = sum;
   }

   let r = Math.random();

   let o = 0;
   for (let i = 0; i < ar.length && r >= ar[i]; i++) {
       o = i;
   }

   return o;
};

app.use(async (ctx, next) => {
    let quickEnd = (txt, code=400) => { ctx.status = code; ctx.type = "json"; ctx.body = txt; }

    try {
        await next();
    } catch (err) {
        if (err.code === "ENOTFOUND") return quickEnd("URL given not valid.");
        else if (err.message === "bad_status") return quickEnd("Requested URL didn't return 200.");
        else if (err.message === "Unsupported image type") return quickEnd("Requested URL returned a non-image body.");
        else if (err.message === "not_png") return quickEnd("Requested URL returned a non-PNG image.");
        else quickEnd("Errors occurred during the process.", 500)
        console.error(err);
    }
})

app.use(ctx => {
    // Only for json errors.
    let quickEnd = (txt, code=400) => { ctx.status = code; ctx.type = "json"; ctx.body = txt; }

    if (!ctx.query["url"]) return quickEnd("No given URL.");

    let url = ctx.query["url"];

    // regex source: https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url#comment113000791_5717133
    // granted it's not really flexible, but i intend to use this only for discord avatar so lax validation is hardly an issue.
    let validURL = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);

    if (validURL === null) return quickEnd("URL given not valid.");

    validURL = validURL[0];

    let prob = (prob=[0.3, 0.3, 0.3, 0.1], funcs=[], params=[]) => {
        let ind = randexec(prob);

        return funcs[ind](...params[ind]);
    }

    switch (ctx.path) {
        case "/cropicle":
            return request(validURL)
                .then(v => { if (v.statusCode !== 200) throw Error("bad_status"); else return v; })
                .then(v => v.body.arrayBuffer())
                .then(v => ImageScript.decode(v))
                .then(v => { if (v instanceof ImageScript.GIF) throw Error("not_png"); else return v; })
                .then(v => ctx.query["wtf"] !== "true" ? v : prob([0.3, 0.3, 0.3, 0.1], [v.red.bind(v), v.blue.bind(v), v.green.bind(v), v.saturation.bind(v)], [[0.3, true], [0.3, true], [0.3, true], [0.9, true]]))//((Math.random() > 0.5) ? v.red(0.3, true) : v.blue(0.3, true)) : v)
                .then(v => v.fisheye().cropCircle().encode(1)) // encode returns as uint8array, so needs to be translated into buffer
                .then(v => { ctx.type = "png"; ctx.body = Buffer.from(v); });
        default:
            return quickEnd("No other endpoint(s) are supported.", 404);
    }
});

app.listen(process.env.PORT || 3000);
console.log("Listening to port: " + (process.env.PORT || 3000));