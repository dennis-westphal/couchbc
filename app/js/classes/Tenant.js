import { Web3Util } from '../utils/Web3Util'
import { TenantReview } from './TenantReview'
import { Conversion } from '../utils/Conversion'

export class Tenant {
	constructor () {
		this.address = ''
		this.publicKey_x = ''
		this.publicKey_y = ''

		this.mediatorStatus = ''

		this.totalScore = 0
		this.rentals = []

		this.numReviews = 0
		this.reviews = []

	}

	/**
	 * Fetch a tenant based on their address
	 *
	 * @param address
	 * @returns {Promise<Tenant>}
	 */
	static async findByAddress (address) {
		let tenantData = await Web3Util.contract.methods.getTenant(address).call()
		let tenant = new Tenant()
		Object.assign(tenant, tenantData)
		tenant.address = address

		// Get the reviews
		let promises = []
		for (let i = 0; i < this.numReviews; i++) {
			promises.push(new Promise(resolve => {
				TenantReview.find(this, i).then(review => {
					tenant.reviews.push(review)
					resolve()
				})
			}))
		}

		await Promise.all(promises)
		return tenant
	}

	/**
	 * Get the public key buffer for the tenant
	 *
	 * @returns {Uint8Array}
	 */
	get publicKeyBuffer () {
		return Conversion.getUint8ArrayBufferFromXY(this.publicKey_x, this.publicKey_y)
	}
}
