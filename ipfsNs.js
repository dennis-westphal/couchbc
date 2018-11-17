// Import libraries
const express = require('express')
const fs = require('fs')

const EC = require('elliptic').ec
const ec = new EC('secp256k1')
const SHA256 = require('crypto-js/sha256')
const filename = 'mappings.json'
const port = 8090

const app = express()
app.use(express.json())

// Read the current contents if the file exists
let mappings = (fs.existsSync(filename))
	? JSON.parse(fs.readFileSync(filename))
	: {}

/**
 * Fetch a mapping for the specified id
 */
app.get('/:id', (req, res) => {
	// Check that we have a valid id
	if (req.params.id.length === 0) {
		res.writeHead(400, {'Content-Type': 'text/plain'})
		res.end('Expected valid id')
		return
	}

	// Check that the mapping exists
	if (typeof mappings[req.params.id] === 'undefined') {
		res.writeHead(404, {'Content-Type': 'text/plain'})
		res.end('Could not find mapping for the specified id')
		return
	}

	// Respond with the address
	res.writeHead(200, {'Content-Type': 'text/plain'})
	res.end(mappings[req.params.id].address)
})

/**
 * Add a mapping for the specified id
 */
app.post('/:id', (req, res) => {
	// Check that we have a valid id
	if (req.params.id.length === 0) {
		res.writeHead(400, {'Content-Type': 'text/plain'})
		res.end('Expected valid id')
		return
	}

	let body = req.body

	// Check that the query params exist
	if (typeof body.address === 'undefined' || body.publicKeyX === 'undefined' || body.publicKeyY === 'undefined') {
		res.writeHead(400, {'Content-Type': 'text/plain'})
		res.end('Required body parameters missing; expected address, publicKeyX (hex unprefixed) and publicKeyY (hex unprefixed)')
		return
	}

	// Check that the mapping does not exist yet
	if (typeof mappings[req.params.id] !== 'undefined') {
		res.writeHead(409, {'Content-Type': 'text/plain'})
		res.end('Mapping of the id already exists')
		return
	}

	// Add the mapping
	mappings[req.params.id] = {
		address:    body.address,
		publicKeyX: body.publicKeyX,
		publicKeyY: body.publicKeyY
	}

	// Update the file
	fs.writeFileSync(filename, JSON.stringify(mappings))

	res.writeHead(200, {'Content-Type': 'text/plain'})
	res.end(body.address)
})

/**
 * Change the mapping for the specified ID. Requires authentication through signed message.
 */
app.put('/:id', (req, res) => {
	// Check that we have a valid id
	if (req.params.id.length === 0) {
		res.writeHead(400, {'Content-Type': 'text/plain'})
		res.end('Expected valid id')
		return
	}

	let body = req.body

	// Check that the query params exist
	if (typeof body.address === 'undefined' || body.signature === 'undefined') {
		res.writeHead(400, {'Content-Type': 'text/plain'})
		res.end('Required body parameters missing; expected address and signature (JSON encoded object with r & s hex, unprefixed)')
		return
	}

	// Check that the mapping exists
	if (typeof mappings[req.params.id] === 'undefined') {
		res.writeHead(404, {'Content-Type': 'text/plain'})
		res.end('Could not find mapping for the specified id')
		return
	}

	let mapping = mappings[req.params.id]

	let pub = {x: mapping.publicKeyX, y: mapping.publicKeyY}
	let key = ec.keyFromPublic(pub, 'hex')

	let messageHash = SHA256(req.params.id + '-' + body.address).words
	let signature = JSON.parse(body.signature)

	// Check that the signature matches
	if (!key.verify(messageHash, signature)) {
		res.writeHead(403, {'Content-Type': 'text/plain'})
		res.end('Access to mapping forbidden; signature mismatch')
		return
	}

	// Set the changed address
	mappings[req.params.id].address = body.address

	// Update the file
	fs.writeFileSync(filename, JSON.stringify(mappings))

	res.writeHead(200, {'Content-Type': 'text/plain'})
	res.end(body.address)
})

app.listen(port)
