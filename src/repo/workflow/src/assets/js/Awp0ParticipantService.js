// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0ParticipantService
 */
import AwPromiseService from 'js/awPromiseService';

import constantsService from 'soa/constantsService';
import cdmService from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import messagingService from 'js/messagingService';
import dataManagementService from 'soa/dataManagementService';
import localeService from 'js/localeService';
import cmmService from 'soa/kernel/clientMetaModel';

import _ from 'lodash';
import adapterSvc from 'js/adapterService';

var exports = {};

/**
  * Open the repalce particiapnt panel based on input selection and context
  *
  * @param {Object} selectedItemRevision - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {Object} selParticipantObject - Selected participant object that need to be replaced
  */
export let replaceParticipants = function( selectedItemRevision, commandContext, selParticipantObject ) {
    // Check if input item revision is null or comamnd context or obejct set source on command context is null
    // then no need to proceed further and return from here
    if( !selectedItemRevision || !commandContext || !selParticipantObject ) {
        return;
    }
    var participantType = null;
    var isParticipantTable = false;
    // Get the adapted object in we are getting selected participant as Awp0ObjectSetRow
    var selectedParticipants = adapterSvc.getAdaptedObjectsSync( [ selParticipantObject ] );
    if( selectedParticipants && selectedParticipants[0] ) {
        selParticipantObject = _.clone( selectedParticipants[0] );
    }

    // If comamnd context has objectSetSource that means we are doing action from object set table and
    // if we are doing it from participant table then get the participant type from object
    if( commandContext.objectSetSource ) {
        var objectSetSource = commandContext.objectSetSource;
        participantType = objectSetSource.substring( objectSetSource.indexOf( '.' ) + 1, objectSetSource.length );
    } else if( commandContext && commandContext.isParticipantTable && selParticipantObject.participantType ) {
        participantType = selParticipantObject.participantType;
        isParticipantTable = true;
    }

    // If participant type is null then no need to process further
    if( !participantType ) {
        return;
    }

    //Popualte the particiapnt type contanst based on validate brign the panel or show the error to user
    _populateParticipantTypesMap( selectedItemRevision, participantType, commandContext, false ).then( function( result ) {
        var context = {
            selectedObject: selectedItemRevision,
            loadProjectData: true,
            participantType: participantType,
            selParticipantObject: selParticipantObject,
            resourceProvider: 'Awp0ResourceProvider'
        };

        var additionalSearchCriteria = {
            participantType : participantType
        };

        context.additionalSearchCriteria = additionalSearchCriteria;
        // This is mainly needed to reload participant table when user do replace action.
        context.isParticipantTable = isParticipantTable;

        // Open replace participant panel and pass all context info as well and panel will use this context
        // info to populate all widgets on UI.
        commandPanelService.activateCommandPanel( 'Awp0ReplaceParticipant', 'aw_toolsAndInfo', context );
    } );
};

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};


/**
  * extract type name from uid
  *
  * @param {string} uid model type uid
  * @returns {string}  Type name extraced from input
  */
var _getModelTypeNameFromUid = function( uid ) {
    var tokens = uid.split( '::' );
    if( tokens.length === 4 && tokens[ 0 ] === 'TYPE' ) {
        return tokens[ 1 ];
    }
    return null;
};

/**
  * Open the add particiapnt panel based on input selection and context
  *
  * @param {Object} selectedObject - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {ctx} ctx - The app context object
  *
  * @returns {object} Return null in case of invalid selection
  */
export let addParticipants = function( selectedObject, commandContext, ctx ) {
    // Check if input item revision is null or comamnd context or obejct set source on command context is null
    // then no need to proceed further and return from here
    if( !selectedObject || !commandContext  ) {
        return;
    }
    var participantType = null;
    var validSelectedObject = selectedObject;
    // If comamnd context has objectSetSource that means we are doing action from object set table and
    // if we are doing it from participant table then get the participant type from object
    if( commandContext.objectSetSource ) {
        var objectSetSource = commandContext.objectSetSource;
        participantType = objectSetSource.substring( objectSetSource.indexOf( '.' ) + 1, objectSetSource.length );
    } else if( commandContext.isParticipantTable ) {
        participantType = selectedObject.participantType;
        validSelectedObject = ctx.xrtSummaryContextObject;
    }

    // Check if Add participant is already active then panel should get closed
    if( ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'AddParticipant' ) {
        commandPanelService.activateCommandPanel( 'AddParticipant', 'aw_toolsAndInfo', null, null, null, {
            isPinUnpinEnabled: true
        } );
        return;
    }

    var objectsToLoad = [];
    objectsToLoad.push( validSelectedObject );
    var deferred = AwPromiseService.instance.defer();
    if( isOfType( validSelectedObject, 'ItemRevision' )  ) {
        dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'allowable_participant_types', 'assignable_participant_types', 'awp0RequiredParticipants' ] ).then( function() {
            // This is needed to pass the correct updated object to other method
            var modelObject = cdmService.getObject( validSelectedObject.uid );
            exports.openAddParticipantPanel( modelObject, commandContext, participantType, deferred, ctx );
        } );
    }
    return deferred.promise;
};


/**
  * Populate the participant type constant map that particiapnt can be added or not
  *
  * @param {Object} selectedItemRevision Selected ditem revision
  * @param {String} particiapntType Particiapnt type string
  * @param {ctx} App context object
  * @param {boolean} isAddCase True/False based on we are trying to add participant or replace.
  *
  * @returns{Object} Partiticiapnt type map
  */
var _populateParticipantTypesMap = function( selectedItemRevision, particiapntType, commandContext, isAddCase ) {
    var deferred = AwPromiseService.instance.defer();
    var constantTypesToPopulated = [];
    var allParticipantTypes = [];
    var isMultiParticipantCase = false;

    // Check if multiple participant data needs to be populated then add to the list so that
    // SOA can be called for those participants else add the input participant type to the list.
    if( isAddCase && commandContext.isParticipantTable && commandContext.assignableParticipantTypes )  {
        isMultiParticipantCase = true;
        _.forEach( commandContext.assignableParticipantTypes, function( participantObj ) {
            allParticipantTypes.push( participantObj.propInternalValue );
        } );
    } else if( particiapntType ) {
        allParticipantTypes.push( particiapntType );
    }

    _.forEach( allParticipantTypes, function( participantName ) {
        var object1 = {
            typeName: participantName,
            constantName: 'ParticipantAllowMultipleAssignee'
        };


        constantTypesToPopulated.push( object1 );
    } );

    if( constantTypesToPopulated.length > 0 ) {
        var multipleAllowedMap = [];


        var multiParticipantDataMap = {};
        constantsService.getTypeConstantValues( constantTypesToPopulated ).then( function( response ) {
            if( response && response.constantValues && response.constantValues.length > 0 ) {
                var typeConstantValues = response.constantValues;

                _.forEach( typeConstantValues, function( constantValue ) {
                    var constantKey = constantValue.key;
                    var constantName = constantKey.constantName;
                    var participantName = constantKey.typeName;
                    var value = constantValue.value;

                    var object = {
                        typeName: constantKey.typeName,
                        value: constantValue.value
                    };

                    var selectModelMode = 'single';
                    if( !multiParticipantDataMap[ participantName ]  ) {
                        multiParticipantDataMap[ participantName ] = {};
                    }
                    if( constantName === 'ParticipantAllowMultipleAssignee' ) {
                        multipleAllowedMap.push( object );
                        if( isMultiParticipantCase ) {
                            if( value === 'true' ) {
                                selectModelMode = 'multiple';
                            }
                            multiParticipantDataMap[ participantName ].selectModelMode = selectModelMode;
                        }
                    }
                } );
                var output = {
                    multipleAllowedMap: multipleAllowedMap,


                    multiParticipantDataMap : multiParticipantDataMap
                };

                deferred.resolve( output );
            }
        } );
    } else {
        deferred.resolve( {} );
    }
    return deferred.promise;
};


/**
  * Check if user is in object set table and table is not empty then return false. Else if user is in
  * participant table and selected object is participant object then return false.
  * @param {Object} commandContext Command context object
  *
  * @returns {boolean} True/False based on validation criteria
  */
var _isValidToOpenPanel = function( commandContext ) {
    if( commandContext && commandContext.dataProvider && commandContext.dataProvider.viewModelCollection.totalObjectsLoaded > 0 ) {
        return false;
    }
    // Check if we are in participant table then we need to return true from here.
    if( commandContext && commandContext.isParticipantTable ) {
        return true;
    }
    return true;
};

/**
  * Get the participant type user is trying to add, This is mainly needed for simple
  * change participant table.
  * @param {String} participantType Participant type user trying to add
  * @param {Object} commandContext Command context object
  * @returns {String} Selected participant type
  */
var _getParticipantTypeFromTable = function( participantType, commandContext ) {
    var selectedParticipantType = participantType;
    if( !commandContext || !commandContext.isParticipantTable ) {
        return selectedParticipantType;
    }
    if( commandContext.assignableParticipantTypes ) {
        selectedParticipantType = commandContext.assignableParticipantTypes[0].propInternalValue;
    }
    // Check if selected objects is not null and 0th object is not null then get the participant type from selected
    // object and add it to context. This is mainly needed for participant table then get the type from select object.
    if( commandContext.selectedObjects && commandContext.selectedObjects[ 0 ] && commandContext.selectedObjects[ 0 ].participantType ) {
        var selType = commandContext.selectedObjects[ 0 ].participantType;
        // Check if selected object participant type present in assignableParticipantTypes list then only use
        // selected object participant type else use 0th index value from assignableParticipantTypes list.
        var index1 = _.findIndex( commandContext.assignableParticipantTypes, function( particiapntTypeObject ) {
            return particiapntTypeObject.propInternalValue === selType;
        } );
        if( index1 > -1 ) {
            selectedParticipantType = selType;
        }
    }
    return selectedParticipantType;
};


/**
  * Open the add particiapnt panel based on input selection and context
  *
  * @param {Object} selectedItemRevision - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {Object} participantType - The participant type where user want to add
  * @param {Object} result - The object that contains all particiapnt related info
  * @param {Object} deferred - The deferred object
  *
  */
var _openParticipantPanel = function( selectedItemRevision, commandContext, participantType, result, deferred ) {
    var selectModelMode = 'single';
    if( !result ) {
        deferred.resolve();
        return;
    }

    // Get the valid participant type user trying to add. This is mainly needed when
    // for when we show participant as table like simple chnage participant table
    participantType = _getParticipantTypeFromTable( participantType, commandContext );

    var multipleAllowedMap = result.multipleAllowedMap;

    if( multipleAllowedMap && multipleAllowedMap.length > 0 ) {
        for( var idx = 0; idx < multipleAllowedMap.length; idx++ ) {
            if( multipleAllowedMap[ idx ] && multipleAllowedMap[ idx ].typeName === participantType && multipleAllowedMap[ idx ].value === 'true' ) {
                selectModelMode = 'multiple';
                break;
            }
        }
    }

    if( selectModelMode === 'single' && !_isValidToOpenPanel( commandContext ) ) {
        var objectString = TypeDisplayNameService.instance.getDisplayName( selectedItemRevision );

        var resource = '/i18n/WorkflowCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );

        var message = messagingService.applyMessageParams( localTextBundle.ParticipantNotAllowMultipleUserErrorMessages, [ 'objectString', '{{messageString}}' ], {
            objectString: objectString,
            messageString: participantType
        } );
        messagingService.showError( message );
        deferred.resolve();
    } else {
        var context = {
            selectedObject: selectedItemRevision,
            loadProjectData: true,
            participantType: participantType,
            resourceProvider: 'Awp0ResourceProvider',
            selectionModelMode: selectModelMode,
            multiParticipantDataMap : result.multiParticipantDataMap
        };

        var additionalSearchCriteria = {
            participantType : participantType
        };

        context.additionalSearchCriteria = additionalSearchCriteria;


        // Check if command context is not null and context has table information then we
        // need to get assignableParticipantTypes and participant type from selected and if present
        // then set it to additional search criteria. This is mainly used when we show Participant list
        // box on user picker panel and if selected participant is not null then we need to select that
        // participant type default in list box.
        if( commandContext && commandContext.isParticipantTable && participantType ) {
            context.assignableParticipantTypes = commandContext.assignableParticipantTypes;
            context.isParticipantTable = true;
            context.additionalSearchCriteria.participantType = participantType;
            context.participantType = participantType;
        }

        // Open add participant panel and pass all context info as well and panel will use this context
        // info to populate all widgets on UI.
        commandPanelService.activateCommandPanel( 'AddParticipant', 'aw_toolsAndInfo', context, null, null, {
            isPinUnpinEnabled: true
        } );
        deferred.resolve();
    }
};


/**
  * Get the property DB value based on input property name.
  *
  * @param {Object} modelObject Object properties need to be loaded
  * @param {String} propName Property name that need to be loaded
  *
  * @return {Object} Property DB value for object
  */
var _getPropDBValues = function( modelObject, propName ) {
    if( modelObject.props && modelObject.props[ propName ] && modelObject.props[ propName ].dbValues ) {
        return modelObject.props[ propName ].dbValues;
    }
    return null;
};

/**
  * Get allowable particiapnt type proeprty value list from input item revision.
  *
  * @param {Object} selectedItemRevision Selected item revision object
  *
  * @return {objectsArray} AllowableParticipantTypesList property value list
  *
  */
var _getAllowableParticipantTypesList = function( selectedItemRevision ) {
    var allowableParticipantTypesList = [];
    // Check if input model object is valid then get the latest model object
    // from client data model that will have latest properties loaded
    if( selectedItemRevision && selectedItemRevision.uid ) {
        selectedItemRevision = cdmService.getObject( selectedItemRevision.uid );
    }
    var allowableParticipantTypes = _getPropDBValues( selectedItemRevision, 'allowable_participant_types' );

    if( allowableParticipantTypes && allowableParticipantTypes.length > 0 ) {
        _.forEach( allowableParticipantTypes, function( type ) {
            var typeName = _getModelTypeNameFromUid( type );
            if( typeName ) {
                allowableParticipantTypesList.push( typeName );
            }
        } );
    }
    return allowableParticipantTypesList;
};

/**
  * Get allowable particiapnt type proeprty value list from input item revision.
  *
  * @param {Object} selectedItemRevision Selected item revision object
  *
  * @return {objectsArray} AllowableParticipantTypesList property value list
  *
  */
var _getAssignableParticipantTypesList = function( selectedItemRevision ) {
    var assignableParticipantTypesList = [];
    // Check if input model object is valid then get the latest model object
    // from client data model that will have latest properties loaded
    if( selectedItemRevision && selectedItemRevision.uid ) {
        selectedItemRevision = cdmService.getObject( selectedItemRevision.uid );
    }
    var assignableParticipantTypes = _getPropDBValues( selectedItemRevision, 'assignable_participant_types' );

    if( assignableParticipantTypes && assignableParticipantTypes.length > 0 ) {
        _.forEach( assignableParticipantTypes, function( type ) {
            var typeName = _getModelTypeNameFromUid( type );
            if( typeName ) {
                assignableParticipantTypesList.push( typeName );
            }
        } );
    }
    return assignableParticipantTypesList;
};

/**
  * Open the add particiapnt panel based on input selection and context
  *
  * @param {Object} selectedItemRevision - Selected item revision where repalce action is initiated
  * @param {commandContext} commandContext - The qualified data of the viewModel
  * @param {Object} participantType - The participant type where user want to add
  * @param {Object} deferred - The deferred object
  * @param {Object} ctx Context object
  */
export let openAddParticipantPanel = function( selectedItemRevision, commandContext, participantType, deferred, ctx ) {
    // Get allowable and assignable particiapnt types for input item revision
    var allowableParticipantTypesList = _getAllowableParticipantTypesList( selectedItemRevision );
    var assignableParticipantTypesList = _getAssignableParticipantTypesList( selectedItemRevision );

    var isValidAllowable = true;
    var isValidAssignable = true;

    if( participantType && allowableParticipantTypesList && allowableParticipantTypesList.indexOf( participantType ) === -1 ) {
        isValidAllowable = false;
    }

    if( participantType && assignableParticipantTypesList && assignableParticipantTypesList.indexOf( participantType ) === -1 ) {
        isValidAssignable = false;
    }

    if( !isValidAllowable || !isValidAssignable ) {
        var objectString = TypeDisplayNameService.instance.getDisplayName( selectedItemRevision );
        var participantDisplayName = participantType;
        if( participantType ) {
            var participantTypeObject = cmmService.getType( participantType );
            if( participantTypeObject && participantTypeObject.displayName ) {
                participantDisplayName = participantTypeObject.displayName;
            }
        }
        var resource = '/i18n/WorkflowCommandPanelsMessages';
        var localTextBundle = localeService.getLoadedText( resource );

        var message = messagingService.applyMessageParams( localTextBundle.allowableParticipantErrorMessages, [ '{{messageString}}', 'objectString' ], {
            messageString: participantDisplayName,
            objectString: objectString
        } );
        messagingService.showError( message );
        deferred.resolve();
        return;
    }

    //Popualte the particiapnt type contanst based on validate brign the panel or show the error to user
    _populateParticipantTypesMap( selectedItemRevision, participantType, commandContext, true ).then( function( result ) {
        _openParticipantPanel( selectedItemRevision, commandContext, participantType, result, deferred );
    } );
};

/**
  * Check whether participant can be removed or not.
  *
  * @param {Object} selectedItemRevision - Selected item revision where remove participant action is initiated
  * @param {Object} selectedParticipants - Selected Participants
  * @param {boolean} isReplaceCase - True or false based on user is doing remove or repalce
  *
  * @returns {Promise} Promise object
  *
  */
export let canRemoveOrReplaceParticipant = function( selectedItemRevision, selectedParticipants, isReplaceCase ) {
    var deferred = AwPromiseService.instance.defer();

    //Get assignable_participant_types property from server first because property might not be cached or value might be outdated.
    var objectsToLoad = [];
    objectsToLoad.push( selectedItemRevision );

    dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'assignable_participant_types' ] ).then( function() {
        var assignableParticipantTypesList = _getAssignableParticipantTypesList( selectedItemRevision );
        var isValidAssignable = true;

        var participantDisplayName = null;

        if( selectedParticipants && selectedParticipants.length > 0 ) {
            // Get the adapted object in we are getting selected participant as Awp0ObjectSetRow
            selectedParticipants = adapterSvc.getAdaptedObjectsSync( selectedParticipants );
            for( var idx = 0; idx < selectedParticipants.length; idx++ ) {
                var participantType = selectedParticipants[ idx ].type;

                participantDisplayName = participantType;
                if( selectedParticipants[ idx ].modelType && selectedParticipants[ idx ].modelType.displayName ) {
                    participantDisplayName = selectedParticipants[ idx ].modelType.displayName;
                }

                if( assignableParticipantTypesList && assignableParticipantTypesList.indexOf( participantType ) === -1 ) {
                    isValidAssignable = false;
                    break;
                }
            }
            if( !isValidAssignable ) {
                var objectString = TypeDisplayNameService.instance.getDisplayName( selectedItemRevision );
                var resource = '/i18n/WorkflowCommandPanelsMessages';
                var localTextBundle = localeService.getLoadedText( resource );
                if( !participantDisplayName ) {
                    participantDisplayName = participantType;
                }
                var defaultMessage = localTextBundle.removeParticipantErrorMessages;
                if( isReplaceCase ) {
                    defaultMessage = localTextBundle.replaceParticipantErrorMessages;
                }

                var message = messagingService.applyMessageParams( defaultMessage, [ '{{messageString}}', 'objectString' ], {
                    messageString: participantDisplayName,
                    objectString: objectString
                } );
                messagingService.showError( message );
                deferred.reject( message );
            } else {
                deferred.resolve();
            }
        } else {
            deferred.resolve();
        }
    } );
    return deferred.promise;
};

/**
  * This function checkes if user is removing any participant and that participant type is required
  * then we need to refresh the whole page else we just need to refresh the table. Based on that it
  * will return true /false.
  *
  * @param {Object} response SOA response object after remove participant action
  * @param {Object} selectedObject Selected item revision objects
  * @param {Array} participantObjects Participant objects need to be removed
  *
  * @returns {boolean} True/False based on page need to be refresh or not.
  */
export let getRemoveParticipantPageRefreshNeeded = function( response, selectedObject, participantObjects ) {
    var isRefreshFlag = false;
    // Check if input is not valid then no need to process further and return false from here.
    if( !response || !selectedObject || !participantObjects || participantObjects.length <= 0 ) {
        return isRefreshFlag;
    }

    var removedParticipantTypes = [];
    // Get all participant types that user is trying to remove and store in the list
    _.forEach( participantObjects, function( participantObj  ) {
        if( participantObj && participantObj.type ) {
            removedParticipantTypes.push( participantObj.type );
        }
    } );

    // Get the awp0RequiredParticipants value from selected item revision and check if it matches
    // with any value user is trying to remove from table then if any one common type found then
    // we need to return true so that whole page will be refresh and required label will be shown
    // correctly else we just return false from here and individual table will get updated.
    var modelObject = cdmService.getObject( selectedObject.uid );
    if( modelObject && modelObject.props && modelObject.props.awp0RequiredParticipants ) {
        var requiredParticipants = modelObject.props.awp0RequiredParticipants.dbValues;
        var commonTypes = _.intersection( requiredParticipants, removedParticipantTypes );
        if( commonTypes && commonTypes.length > 0 ) {
            isRefreshFlag = true;
        }
    }
    return isRefreshFlag;
};

/**
  * Get the valid selection and selected participants object that will be needed to remove. Based
  * on different location and differnet cases get the details from correct object and return it.
  *
  * @param {Object} commandContext Command context object to get the correct selection
  * @returns {Object} Valid parent selection and selected participant objects
  */
export let getRemoveParticipantObjects = function( commandContext ) {
    var validSourceObject = null;
    var selectedParticipants = [];
    // Check if command context is null then return the empty details.
    if( !commandContext ) {
        return {
            selectedObject: validSourceObject,
            selectedParticipants : selectedParticipants
        };
    }

    // If command context is participant table then get the correct selection from vmo object.
    // If not the participant table, then check if pselected info present on selection data then
    // use that info else if opened object is not null and selection info not present then use
    // opened object as valid object
    if( commandContext.isParticipantTable ) {
        validSourceObject = commandContext.vmo;
    } else if( commandContext.selectionData && commandContext.selectionData.value && commandContext.selectionData.value.pselected ) {
        validSourceObject = commandContext.selectionData.value.pselected;
    } else if( commandContext.openedObject && ( !commandContext.selectionData || !commandContext.selectionData.value || !commandContext.selectionData.value.pselected ) ) {
        validSourceObject = commandContext.openedObject;
    }

    // Get the adapted object from valid source object so that will be used for SOA calls.
    if( validSourceObject ) {
        var adaptedObjs = adapterSvc.getAdaptedObjectsSync( [ validSourceObject ] );
        if( adaptedObjs && !_.isEmpty( adaptedObjs ) ) {
            validSourceObject = adaptedObjs;
        }
    }

    // If command context is participant table then get the selectedObjects from context
    // else get the selected from selectionData on command context.
    if( commandContext.isParticipantTable ) {
        selectedParticipants = commandContext.selectedObjects;
    } else if( commandContext.selectionData && commandContext.selectionData.value && commandContext.selectionData.value.selected  ) {
        selectedParticipants = commandContext.selectionData.value.selected;
    }

    return {
        selectedObject: validSourceObject,
        selectedParticipants : selectedParticipants
    };
};

export default exports = {
    replaceParticipants,
    addParticipants,
    openAddParticipantPanel,
    canRemoveOrReplaceParticipant,
    getRemoveParticipantPageRefreshNeeded,
    getRemoveParticipantObjects
};

