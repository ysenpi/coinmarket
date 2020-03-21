const express = require('express')
const app = express()
const exphbs = require('express-handlebars')
const mongoose = require('mongoose')
const fetch = require('node-fetch')
const config = require('config')

const vkcoin = require(__dirname + '/models/vkcoin.js')
const order = require(__dirname + '/models/order.js')

const hbs =  exphbs.create({
	extname: 'hbs',
	layoutsDir: __dirname + '/public',
	defaultLayout: 'MainTemplate',
	partialsDir: __dirname + '/views/partials'
})

app.engine('hbs', hbs.engine)
app.set('view engine', 'hbs')
app.set('views', 'views')

app.use(express.json())
app.use(require(__dirname + '/routes/web.js'))
app.use(require(__dirname + '/routes/callback.js'))
app.use(express.static(__dirname + '/public'))

app.use(vkcoin.updates.getExpressMiddleware('/callback/vkcoin'))

vkcoin.updates.onTransfer(async (event) => {

	let result = await order.findOne({
		comment: event.payload,
		amount: event.amount,
		vk: { from: event.fromId, to: event.toId },
		status: 'Ожидание оплаты'
	})

	if (result) {
		console.log('send pay to qiwi')

		let data = {
	        id: (1000 * Date.now()).toString(),
	        sum: {
	          amount: result.price.toFixed(2),
	          currency: '643'
	        },
	        paymentMethod: {
	          type: 'Account',
	          accountId: '643'
	        },
	        comment: result.comment,
	        fields: {
	          account: '+' + result.qiwi.to
	        }
    	}

		let resQiwi = await fetch('https://edge.qiwi.com/sinap/api/v2/terms/99/payments', {
			method: 'post',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				Authorization: `Bearer ${config.get('qiwiToken')}`
			},
			body: JSON.stringify(data)
		})

		//console.log(await resQiwi.json())

		result.status = 'Оплачено'
  		result.save()
	}
	else {
		console.log('not found or payed')
	}
})

async function init() {
	try {
		await mongoose.connect('mongodb+srv://clash:VladilenPro228@cluster0-ikqhy.mongodb.net/coinmarket', {
			useNewUrlParser: true,
			useFindAndModify: false,
			useUnifiedTopology: true
		})

		const PORT = config.get('PORT')

		app.listen(PORT, () => console.log(`Server is running on port: ${PORT}`))

	} catch (e) {
		console.log(e)
	}
}

init()