import { Web3Util } from '../utils/Web3Util'
import { IpfsUtil } from '../utils/IpfsUtil'

export class TenantReview {
	constructor () {
		this.id = 0
		this.tenantAddress = ''

		this.score = 0
		this.hash = ''
		this.ipfsHash = ''
		this.text = ''
	}

	/**
	 * Find a review for the tenant at the specified id. Decrypts the review if the ecAccount was given.
	 *
	 * @param tenant
	 * @param id
	 * @param ecAccount
	 * @return {Promise<TenantReview>}
	 */
	static async find (tenant, id, ecAccount) {
		let reviewData = await Web3Util.contract.methods.getTenantReview(tenant.address, id)
		let review = new TenantReview()
		Object.assign(review, reviewData)
		review.id = id
		review.tenant = tenant

		// If we have an ecAccount, we can download the review and decrypt it
		if (ecAccount) {
			let text = IpfsUtil.downloadDataFromHexHash(review.ipfsHash, ecAccount)

			// Don't add it to the review if the hash doesn't match
			let calculatedHash = Web3Util.web3.utils.sha3(text)
			if (review.hash !== calculatedHash) {
				console.error('Hash of review text doesn\'t match: ' + review.hash + ' (expected) vs ' + calculatedHash + ' (calculated from provided text)')
				return review
			}

			review.text = text
		}

		return review
	}
}
