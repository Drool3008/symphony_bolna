import { createApi } from './client.js'
import { identityHeaders } from './identity.js'

/** The app's one API client, tied to the chosen member. */
export const api = createApi({ headers: identityHeaders })

export { ApiError } from './client.js'
export { chooseMember, chosenMember, forgetMember } from './identity.js'
