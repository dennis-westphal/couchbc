import store from '../store.js'
import { Notifications } from './Notifications'

export class MapsUtil {
	/**
	 * Get the longitude and latitude for the supplied address as object {ltd: 0.00, lng: 0.00}
	 *
	 * @param address
	 * @return {Promise<object>}
	 */
	static async getMapsAddressPosition (address) {
		return new Promise(function (resolve, reject) {
			store.getters.googleMapsGeocoder.geocode({'address': address}, function (results, status) {
				if (status === 'OK') {
					resolve({
						lat: results[0].geometry.location.lat(),
						lng: results[0].geometry.location.lng()
					})
				} else {
					console.error(status, results)

					Notifications.show('Could not find location of address ' + address)

					reject()
				}
			})
		})
	}

	/**
	 * Extract address data from a gmaps places result
	 * @param placesResult
	 * @return {{latitude: number, longitude: number, country: string, zip: string, city: string, street: string, number: string}}
	 */
	static extractAddressData (placesResult) {
		let addressData = {
			latitude:  placesResult.geometry.location.lat(),
			longitude: placesResult.geometry.location.lng()
		}

		for (let component of placesResult.address_components) {
			if (component.types.indexOf('country') !== -1) {
				addressData.country = component.long_name
				continue
			}
			if (component.types.indexOf('postal_code') !== -1) {
				addressData.zip = component.long_name
				continue
			}
			if (component.types.indexOf('locality') !== -1) {
				addressData.city = component.long_name
				continue
			}
			if (component.types.indexOf('route') !== -1) {
				addressData.street = component.long_name
				continue
			}
			if (component.types.indexOf('street_number') !== -1) {
				addressData.number = component.long_name
			}
		}

		return addressData
	}
}
