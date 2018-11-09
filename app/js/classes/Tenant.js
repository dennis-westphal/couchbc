import { Web3Util } from '../utils/Web3Util'
import { TenantReview } from './TenantReview'

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
		let tenantData = await Web3Util.contract.methods.getTenant(address)
		let tenant = new Tenant()
		Object.assign(tenant, tenantData)
		this.address = address

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
}
