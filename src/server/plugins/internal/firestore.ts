/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Google
 - Steven Wijaya <stevenwjy@google.com>
 --------------
 ******/

import { Plugin, Server } from '@hapi/hapi'

import firebase from '~/lib/firebase'
import { Transaction } from '~/models/transaction'

export type TransactionHandler = (server: Server, transaction: Transaction) => Promise<void>

/**
 * An interface definition for options that need to be specfied to use this plugin.
 */
export interface Options {
  handlers: {
    transactions: {
      onCreate?: TransactionHandler
      onUpdate?: TransactionHandler
      onRemove?: TransactionHandler
    }
  }
}

/**
 * Listens to events that happen in the "transactions" collection.
 * Note that when the server starts running, all existing documents in Firestore
 * will be treated as a document that is created for the first time. The handler for
 * `onCreate` transaction must be able to differentiate whether a document is created in
 * realtime or because it has persisted in the database when the server starts.
 *
 * @param server a server object as defined in the hapi library.
 * @param options a configuration object for the plugin.
 * @returns a function to unsubscribe the listener.
 */
const listenToTransactions = (server: Server, options: Options): (() => void) => {
  const transactionHandlers = options.handlers.transactions

  return firebase
    .firestore()
    .collection('transactions')
    .onSnapshot((querySnapshot) => {
      querySnapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && transactionHandlers.onCreate) {
          transactionHandlers.onCreate(server, { id: change.doc.id, ...change.doc.data() })

        } else if (change.type === 'modified' && transactionHandlers.onUpdate) {
          transactionHandlers.onUpdate(server, { id: change.doc.id, ...change.doc.data() })

        } else if (change.type === 'removed' && transactionHandlers.onRemove) {
          transactionHandlers.onRemove(server, { id: change.doc.id, ...change.doc.data() })
        }
      })
    })
}

/**
 * A plugin that enables the hapi server to listen to changes in the Firestore
 * collections that are relevant for the PISP demo.
 */
export const Firestore: Plugin<Options> = {
  name: 'PispDemoFirestore',
  version: '1.0.0',
  register: async (server: Server, options: Options) => {
    const unsubscribeTransactions = listenToTransactions(server, options)

    // Unsubscribe to the changes in Firebase when the server stops running.
    server.ext('onPreStop', (_: Server) => {
      unsubscribeTransactions()
    })
  },
}