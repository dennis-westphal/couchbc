import store from '../store.js'
import { hideLoadingDelay, loadingTransitionDuration } from '../constants'

export class Loading {
	/**
	 * Show a loading message. Returns a promise that will resolve once the loading message is fully displayed.
	 *
	 * @param headline
	 * @returns {Promise<any>}
	 */
	static async show (headline) {
		store.commit('showLoading', headline)

		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve()
			}, loadingTransitionDuration)
		})
	}

	/**
	 * Add an element to the loading screen
	 *
	 * @param id
	 * @param text
	 * @param status
	 */
	static add (id, text, status) {
		store.commit('addLoadingElement', {
			id:     id,
			text:   text,
			status: status || 'active'
		})
	}

	/**
	 * Set an element's status on the loading screen
	 *
	 * @param id
	 * @param status
	 */
	static set (id, status) {
		store.commit('setLoadingElementStatus', {
			id:     id,
			status: status
		})
	}

	/**
	 * Set the element's status to success
	 *
	 * @param id
	 */
	static success (id) {
		store.commit('setLoadingElementStatus', {
			id:     id,
			status: 'success'
		})
	}

	/**
	 * Set the element's status to error
	 *
	 * @param id
	 */
	static error (id) {
		store.commit('setLoadingElementStatus', {
			id:     id,
			status: 'error'
		})
	}

	/**
	 * Wait the designated delay, then hide the loading message. Returns a promise that will resolve once the loading message is gone.
	 *
	 * @returns {Promise<any>}
	 */
	static async hide () {
		setTimeout(() => {
			store.commit('hideLoading')
		}, hideLoadingDelay)

		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve()
			}, hideLoadingDelay + loadingTransitionDuration)
		})
	}
}
