// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/epSaveService
 */

import soaService from 'soa/kernel/soaService';
import mfgReadOnlyService from 'js/mfeReadOnlyService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import saveInputWriterService from 'js/saveInputWriterService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import epReviseHelper from 'js/epReviseHelper';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import cdm from 'soa/kernel/clientDataModel';

const REVISE_ERROR_CODE = 161044;

const ignorableErrorIds = [ 38015, 214019, 26003 ];

/**
 * performSaveChangesCall
 *
 * @deprecated please use saveChanges instead
 * @param { Object } input the save input
 * @returns {Promise} save promise
 */
export function performSaveChangesCall( input ) {
    let promise = soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', input );
    return promise.then( function( result ) {
        return result;
    } );
}

/**
 * saveChanges
 *
 * @param {Object} saveInputWriter the save input
 * @param {Boolean} performCheck auto revise flag
 * @param {Array} relatedObjects array of save related model objects
 * @param {Boolean} returnEventsOnError auto revise flag
 * @param {String} resourceBundle the messages file name
 *
 * @returns {Promise} save promise
 */
export function saveChanges( saveInputWriter, performCheck, relatedObjects, returnEventsOnError = false, resourceBundle = 'EPServicesMessages' ) {
    const resource = localeService.getLoadedText( 'epBvrServiceMessages' );
    if( saveInputWriter.sections[ epSaveConstants.OBJECTS_TO_REVISE ] ) {
        // Process top node (Scope of page) is not Checked out so 'mfgReadOnlyService.isReadOnlyMode()' return false.
        // But its child is checked out. This code handles this use-case.
        const object = cdm.getObject( saveInputWriter.sections[ epSaveConstants.OBJECTS_TO_REVISE ].dataEntries[ 0 ].entry.Object.nameToValuesMap.id[ 0 ] );
        if( object.props.bl_rev_checked_out_user && object.props.bl_rev_checked_out_user.dbValues[ 0 ] !== ' ' && object.props.bl_rev_checked_out_user.dbValues[ 0 ] !== appCtxSvc.ctx.userSession.props.user
            .uiValues[ 0 ] && !mfgReadOnlyService.isReadOnlyMode() ) {
            messagingService.showError( resource.readOnlyObjectError.format( object.props.object_string.dbValues[ 0 ], object.props.bl_rev_checked_out_user.dbValues[ 0 ] ) );
            return awPromise.reject();
        }
    }
    let awPromise = AwPromiseService.instance;
    if( mfgReadOnlyService.isReadOnlyMode() && !saveInputWriter.ignoreReadOnlyMode ) {
        messagingService.showError( resource.readOnlyModeError );
        return awPromise.reject();
    }

    saveInputWriter.addSessionInformation( performCheck );
    saveInputWriter.addRelatedObjects( relatedObjects );

    let saveInput = saveInputWriterService.getSaveInput( saveInputWriter );

    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3',
        saveInput ).then( function( result ) {
        let errorCodes = getErrorCodes( result.ServiceData );
        if( shouldIssuePartialError( errorCodes ) ) {
            if( hasReviseError( errorCodes ) ) {
                //handle revise
                return epReviseHelper.displayConfirmationMessage( result, resourceBundle ).then( function() {
                    return saveChanges( saveInputWriter, false, relatedObjects, returnEventsOnError );
                },
                function() {
                    //on discard
                } );
            }
            let err = messagingService.getSOAErrorMessage( result.ServiceData );
            messagingService.showError( err );

            // incase there is results return the save events
            // Might need to be processed
            return result.saveEvents && returnEventsOnError ? result : err;
        }
        eventBus.publish( 'ep.saveEvents', result );
        const saveEvents = result.saveEvents;
        if( saveEvents && saveEvents.length > 0 ) {
            const parsedDeleteSaveEvents = parseSaveEventsData( saveEvents, epSaveConstants.DELETE );
            const parsedAccountabilityEvents = parseAccountabilitySaveEventsData( saveEvents );
            const parsedMultipleEvents = parseMultipleSaveEventsData( saveEvents );
            let parsedAddRemoveSaveEvents = parseSaveEvents( saveEvents );
            parseBackgroundPartSaveEvents( saveEvents, parsedMultipleEvents );
            if( parsedDeleteSaveEvents && parsedDeleteSaveEvents.length > 0 ) {
                eventBus.publish( 'ep.deleteEvents', { deleteSaveEvents : parsedDeleteSaveEvents } );
            }
            if( parsedAccountabilityEvents ) {
                eventBus.publish( 'ep.accountabilityEvents', parsedAccountabilityEvents );
            }
            if( parsedAddRemoveSaveEvents ) {
                eventBus.publish( 'ep.addRemoveEvents', parsedAddRemoveSaveEvents );
            }
            if( parsedMultipleEvents ) {
                eventBus.publish( 'ep.multipleAddRemoveEvents', parsedMultipleEvents );
            }
        }
        return result;
    }, function( error ) {
        let err = messagingService.getSOAErrorMessage( error );
        messagingService.showError( err );
        return err;
    } );
}
/**
 * *
 * @param {Object} saveEvents - the save events returned from the soa server call
 * @returns {Object} parsedSaveEvents
 */
export function parseMultipleSaveEventsData( saveEvents ) {
    let parsedSaveEvents = {};

    //if ( !saveEvent.eventData || saveEvent.eventData.length)
    for( let saveEvent of saveEvents ) {
        if ( saveEvent.eventData ) {
            const eventData = saveEvent.eventData;
            if( eventData && eventData[0] ) {
                if ( !parsedSaveEvents[ eventData[0] ] ) {
                    parsedSaveEvents[ eventData[0] ] = [];
                }
                let parsedMultipleEvent  = {
                    eventObjectUid: saveEvent.eventObjectUid,
                    eventType: saveEvent.eventType
                };

                getMultipleRelatedEvents( saveEvent, parsedMultipleEvent, saveEvents );
                parsedSaveEvents[ eventData[0] ].push( parsedMultipleEvent );
            }
        }
    }

    return parsedSaveEvents;
}

/**
 * Convert the save events to json object
 *
 * Example:
 * ["Mfg0all_material": {
 *      eventObjectUid: "SR::N::Mfg0BvrOperation..2.Xxe7L68ddN55DA.gle5cV8s5QeVTC.Qdd5sNX95QeVTC.iCQ5cXdf5QeVTC.1",
 *      eventType: "modifyRelations",
 *      relatedEvents: [ "removedFromRelation": [
 *              "SR::N::Mfg0BvrPart..1.10CxMJfpdNZ8CB.gle5cV8s5QeVTC.Qdd5sNX95QeVTC.Group:/Thid_BRd58iz85QeVTC/SGX5cXdf5QeVTC/AbV5_lEo5QeVTC.1",
 *              "SR::N::Mfg0BvrPart..1.w2xSPxJbdN5v$B.gle5cV8s5QeVTC.Qdd5sNX95QeVTC.Group:/Thid_BRd58iz85QeVTC/SGX5cXdf5QeVTC/A7d5_lEo5QeVTC.1"
 *          ]
 *      ]
 * }]
 *
 * @param {Object} saveEvents - the save events returned from the soa server call
 * @returns {Object} parsedSaveEvents
 */
export function parseSaveEvents( saveEvents ) {
    let parsedSaveEvents = [];

    for( let saveEvent of saveEvents ) {
        const eventDataArray = saveEvent.eventData;
        if( eventDataArray ) {
            for( let eventData of eventDataArray ) {
                parsedSaveEvents[ eventData ] = {
                    eventObjectUid: saveEvent.eventObjectUid,
                    eventType: saveEvent.eventType
                };
                getRelatedEvents( saveEvent, eventData, saveEvents, parsedSaveEvents );
            }
        }
    }

    return parsedSaveEvents;
}

/**
 *  Parse background part event data
 * @param {Object} saveEvents - the save events returned from the soa server call
 * @param {Object} parsedSaveEvents - parsed save events
 */
function parseBackgroundPartSaveEvents( saveEvents, parsedSaveEvents ) {
    if( saveEvents ) {
        saveEvents.forEach( ( saveEvent ) => {
            if( saveEvent.eventType === epSaveConstants.BACKGROUND_PART_EVENT ) {
                let eventDataMode;
                const eventDataArray = saveEvent.eventData;
                if( eventDataArray ) {
                    eventDataArray.forEach( ( eventData ) => {
                        if( eventData === epSaveConstants.BACKGROUND_PART_ADDED_EVENT || eventData === epSaveConstants.BACKGROUND_PART_REMOVED_EVENT ) {
                            eventDataMode = eventData === epSaveConstants.BACKGROUND_PART_ADDED_EVENT ? epSaveConstants.ADDED_TO_RELATION : epSaveConstants.REMOVED_FROM_RELATION;
                        } else if( eventDataMode ) {
                            if( !parsedSaveEvents[ epSaveConstants.BACKGROUND_PART_EVENT ] ) {
                                parsedSaveEvents[ epSaveConstants.BACKGROUND_PART_EVENT ] = {
                                    eventObjectUid: saveEvent.eventObjectUid,
                                    eventType: saveEvent.eventType
                                };
                                parsedSaveEvents[ epSaveConstants.BACKGROUND_PART_EVENT ].relatedEvents = [];
                                parsedSaveEvents[ epSaveConstants.BACKGROUND_PART_EVENT ].relatedEvents[ eventDataMode ] = [];
                            }
                            parsedSaveEvents[ epSaveConstants.BACKGROUND_PART_EVENT ].relatedEvents[ eventDataMode ].push( eventData );
                        }
                    } );
                }
            }
        } );
    }
}

/**
 *  Parse delete event data
 *
 * @param {Object} eventDataArray - the save events returned from the soa server call
 * @param {String} type - the event type to filter
 *
 * @returns {Object} parsedSaveEvents
 */
function parseSaveEventsData( eventDataArray, type ) {
    const parsedSaveEvents = [];

    if( eventDataArray ) {
        for( let eventData of eventDataArray ) {
            if( eventData.eventType === type ) {
                parsedSaveEvents.push( eventData.eventObjectUid );
            }
        }
    }

    return parsedSaveEvents;
}

/**
 * Parse accountabilityCheck event data
 * @param { Object } eventDataArray - the save events returned from the soa server call
 * @returns { Object } accountabilityEvents - {
 *    missingInSrc: [],
 *    singleConsumptionInScope: [],
 *    singleConsumptionOutOfScope: [],
 *    MultipleConsumptionInScope: [],
 *    MultipleConsumptionOutOfScope: []
 *}
 */
function parseAccountabilitySaveEventsData( eventDataArray ) {
    let accountabilityEvents = {
        missingInSrc: [],
        singleConsumptionInScope: [],
        singleConsumptionOutOfScope: [],
        multipleConsumptionInScope: [],
        multipleConsumptionOutOfScope: []
    };
    if( eventDataArray ) {
        for( let eventData of eventDataArray ) {
            if( eventData.eventType === epSaveConstants.ACCOUNTABILITYCHECK_EVENT ) {
                if( eventData.eventData[ 0 ] === epSaveConstants.MISSING_IN_SOURCE ) {
                    accountabilityEvents.missingInSrc.push( eventData.eventObjectUid );
                } else if( eventData.eventData[ 0 ] === epSaveConstants.SINGLE_CONSUMPTION_IN_SCOPE ) {
                    accountabilityEvents.singleConsumptionInScope.push( eventData.eventObjectUid );
                } else if( eventData.eventData[ 0 ] === epSaveConstants.SINGLE_CONSUMPTION_OUT_OF_SCOPE ) {
                    accountabilityEvents.singleConsumptionOutOfScope.push( eventData.eventObjectUid );
                } else if( eventData.eventData[ 0 ] === epSaveConstants.MULTIPLE_CONSUMPTION_IN_SCOPE ) {
                    accountabilityEvents.multipleConsumptionInScope.push( eventData.eventObjectUid );
                } else if( eventData.eventData[ 0 ] === epSaveConstants.MULTIPLE_CONSUMPTION_OUT_OF_SCOPE ) {
                    accountabilityEvents.multipleConsumptionOutOfScope.push( eventData.eventObjectUid );
                }
            }
        }
    }

    return accountabilityEvents;
}

/**
 * getRelatedEvents - process related events of a single event
 *
 * @param {Object} saveEvent single event
 * @param {Object} eventData Object
 * @param {Array} saveEvents all save events from server
 * @param {Array} parsedSaveEvents all events parsed
 */
function getRelatedEvents( saveEvent, eventData, saveEvents, parsedSaveEvents ) {
    const relatedEvents = saveEvent.relatedEvents;
    if( relatedEvents ) {
        parsedSaveEvents[ eventData ].relatedEvents = [];
        findAndAddRelatedEvents( parsedSaveEvents[ eventData ], relatedEvents, saveEvents );
    }
}

/**
 * getMultipleRelatedEvents - process multiple related events and update it
 *
 * @param {Object} saveEvent single event
 * @param {Object} parsedMultipleEvent Object
 * @param {Array} saveEvents all save events from server
 */
function getMultipleRelatedEvents( saveEvent, parsedMultipleEvent, saveEvents ) {
    const relatedEvents = saveEvent.relatedEvents;
    if( relatedEvents ) {
        if ( !parsedMultipleEvent.relatedEvents ) {
            parsedMultipleEvent.relatedEvents = [];
        }
        findAndAddRelatedEvents( parsedMultipleEvent, relatedEvents, saveEvents );
    }
}

/**
 *
 * @param {Object} event  event
 * @param {Object} relatedEvents relatedEvents
 * @param {Object} saveEvents saveEvents
 */
function findAndAddRelatedEvents( event, relatedEvents, saveEvents ) {
    for( let relatedEvent of relatedEvents ) {
        for( let currSaveEvent of saveEvents ) {
            if( currSaveEvent.eventId === relatedEvent ) {
                const eventType = currSaveEvent.eventType;
                if( !event.relatedEvents[ eventType ] ) {
                    event.relatedEvents[ eventType ] = [];
                }
                event.relatedEvents[ eventType ].push( currSaveEvent.eventObjectUid );
                break;
            }
        }
    }
}

/**
 * getErrorCodes
 *
 * @param {Object} serviceData response
 * @returns {Array} error codes
 */
function getErrorCodes( serviceData ) {
    let errorCodes = [];
    if( serviceData && serviceData.partialErrors ) {
        let partialErrors = serviceData.partialErrors;
        for( let i in partialErrors ) {
            let errors = partialErrors[ i ].errorValues;
            for( let j in errors ) {
                errorCodes.push( errors[ j ].code );
            }
        }
    }
    return errorCodes;
}

/**
 * shouldIssuePartialError
 *
 * @param {Array} errorCodes errors from server
 * @returns {boolean} if should issue partial errors
 */
function shouldIssuePartialError( errorCodes ) {
    for( let index in errorCodes ) {
        if( !_.includes( ignorableErrorIds, errorCodes[ index ] ) ) {
            return true;
        }
    }
    return false;
}

/**
 * hasReviseError
 *
 * @param {Array} errorCodes errors from server
 * @returns {boolean} if one of the errors is revise
 */
function hasReviseError( errorCodes ) {
    return _.includes( errorCodes, REVISE_ERROR_CODE );
}

export default {
    performSaveChangesCall,
    saveChanges,
    parseSaveEvents
};
