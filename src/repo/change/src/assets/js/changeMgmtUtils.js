// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/changeMgmtUtils
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import lovService from 'js/lovService';
import messagingService from 'js/messagingService';
import uwPropertyService from 'js/uwPropertyService';
import cmm from 'soa/kernel/clientMetaModel';
import hostFeedbackSvc from 'js/hosting/sol/services/hostFeedback_2015_03';
import objectRefSvc from 'js/hosting/hostObjectRefService';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import soaSvc from 'soa/kernel/soaService';
import adapterService from 'js/adapterService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import editHandlerService from 'js/editHandlerService';
import addObjectUtils from 'js/addObjectUtils';
import Cm1ChangeCommandService from 'js/Cm1ChangeCommandService';

var exports = {};

/**
   * flag used to turn on trace level logging
   */
var _debug_logIssuesActivity = browserUtils.getWindowLocationAttributes().logIssuesActivity !== undefined;

/**
   * Get Revise Inputs for reviseObjects soa
   *
   * @param deepCopyData property name
   * @return A list of deep copy datas
   */
export let getReviseInputsJs = function( mselected ) {
    var deferred = AwPromiseService.instance.defer();
    var reviseInputsArray = [];
    var reviseInputsMap = new Map();
    var impactedItems = mselected;
    for ( var i = 0; i < impactedItems.length; i++ ) {
        var reviseInputs = {};
        if ( impactedItems[i].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            reviseInputs.item_revision_id = [ '' ];
        }
        reviseInputs.object_desc = [ '' ];
        reviseInputs.fnd0ContextProvider = [ appCtxSvc.ctx.pselected.uid ];

        var reviseInput = {};
        reviseInput.targetObject = impactedItems[i];
        reviseInput.reviseInputs = reviseInputs;
        reviseInputsArray.push( reviseInput );
        reviseInputsMap.set( impactedItems[i].uid, reviseInput );
    }

    var promise = self.setReviseInDeepCopyData( impactedItems, reviseInputsMap );
    if ( promise ) {
        promise.then( function( response ) {
            deferred.resolve( response );
        } );
    }
    return deferred.promise;
};

/**
   * Set deep copy data in revise inputs
   *
   * @param impactedItems The impacted items
   * @param reviseInputsMap Map of impacted items to their reviseIn
   * @return A list of revise inputs with the deep copy datas
   */
self.setReviseInDeepCopyData = function( impactedItems, reviseInputsMap ) {
    var deferred = AwPromiseService.instance.defer();
    var deepCopyDataInputs = [];
    for ( var i = 0; i < impactedItems.length; i++ ) {
        var dcd = {
            operation: 'Revise',
            businessObject: impactedItems[i]
        };
        deepCopyDataInputs.push( dcd );
    }

    var inputData = {
        deepCopyDataInput: deepCopyDataInputs
    };

    var deepCopyInfoMap = [];
    var promise = soaSvc.post( 'Core-2014-10-DataManagement', 'getDeepCopyData', inputData );
    if ( promise ) {
        promise.then( function( response ) {
            if ( response !== undefined ) {
                deepCopyInfoMap = response.deepCopyInfoMap;
                for ( var i = 0; i < impactedItems.length; i++ ) {
                    for ( var b in deepCopyInfoMap[0] ) {
                        if ( deepCopyInfoMap[0][b].uid === impactedItems[i].uid ) {
                            var reviseIn = reviseInputsMap.get( deepCopyInfoMap[0][b].uid );
                            reviseIn.deepCopyDatas = self.convertDeepCopyData( deepCopyInfoMap[1][b] );
                            break;
                        }
                    }
                }
            }
            deferred.resolve( Array.from( reviseInputsMap.values() ) );
        } );
    }
    return deferred.promise;
};

/**
   * Convert Deep Copy Data from client to server format
   *
   * @param deepCopyData property name
   * @return A list of deep copy datas
   */
self.convertDeepCopyData = function( deepCopyData ) {
    var deepCopyDataList = [];
    for ( var i = 0; i < deepCopyData.length; i++ ) {
        var newDeepCopyData = {};
        newDeepCopyData.attachedObject = deepCopyData[i].attachedObject;
        newDeepCopyData.copyAction = deepCopyData[i].propertyValuesMap.copyAction[0];
        newDeepCopyData.propertyName = deepCopyData[i].propertyValuesMap.propertyName[0];
        newDeepCopyData.propertyType = deepCopyData[i].propertyValuesMap.propertyType[0];

        var value = false;
        var tempStrValue = deepCopyData[i].propertyValuesMap.copy_relations[0];
        if ( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.copyRelations = value;

        value = false;
        tempStrValue = deepCopyData[i].propertyValuesMap.isTargetPrimary[0];
        if ( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isTargetPrimary = value;

        value = false;
        tempStrValue = deepCopyData[i].propertyValuesMap.isRequired[0];
        if ( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isRequired = value;

        newDeepCopyData.operationInputTypeName = deepCopyData[i].operationInputTypeName;

        var operationInputs = {};
        operationInputs = deepCopyData[i].operationInputs;
        newDeepCopyData.operationInputs = operationInputs;

        var aNewChildDeepCopyData = [];
        if ( deepCopyData[i].childDeepCopyData && deepCopyData[i].childDeepCopyData.length > 0 ) {
            aNewChildDeepCopyData = self.convertDeepCopyData( deepCopyData[i].childDeepCopyData );
        }
        newDeepCopyData.childDeepCopyData = aNewChildDeepCopyData;
        deepCopyDataList.push( newDeepCopyData );
    }

    return deepCopyDataList;
};

/**
 * Get Input object for new createAndSubmitChangeObject SOA
 * @param {String} boName  Business object type name for object to be created.
 * @param {Object} propertyNameValues Map with key as property name and value as property values.
 * @param {Object} compoundCreateChange Compound object which needs to be created with current object
 * @param {String} panelType CREATE based on which input object will be returned.
 * @returns {Object} Input object
 */
const _getCreateInputObjectForNewSOA = function( boName, propertyNameValues, compoundCreateChange, panelType ) {
    if ( panelType === 'CREATE' ) {
        return {
            boName: boName,
            changeRelatedProps: propertyNameValues,
            compoundCreateChange: compoundCreateChange
        };
    }
};


/**
 * Get Input object for creating change object SOA
 * @param {String} boName  Business object type name for object to be created.
 * @param {Object} propertyNameValues Map with key as property name and value as property values.
 * @param {Object} compoundCreateChange Compound object which needs to be created with current object
 * @param {String} panelType CREATE or DERIVE based on which input object will be returned.
 * @returns {Object} Input object
 */
export let getCreateInputObject = function( boName, propertyNameValues, compoundDeriveInput, panelType ) {
    // If panelType is CREATE, get input object for creating change object SOA.
    // Else, return input object for derive change object SOA.
    if ( panelType === 'CREATE' ) {
        // If minimum TC platform version is 142, get input object for new createAndSubmitChangeObjects SOA.
        // Else, return input object for old SOA.
        if( isTCReleaseAtLeast142() ) {
            return _getCreateInputObjectForNewSOA( boName, propertyNameValues, compoundDeriveInput, panelType );
        }
        return {
            boName: boName,
            propertyNameValues: propertyNameValues,
            compoundCreateInput: compoundDeriveInput
        };
    }
    return {
        boName: boName,
        propertyNameValues: propertyNameValues,
        compoundDeriveInput: compoundDeriveInput
    };
};

/**
 * Update parentCreateInput object with updated compoundCreateInput or compoundCreateChange property value.
 * @param {String} panelType CREATE, based on which input object will be updated
 * @param {String} propName Name of the property
 * @param {Object} childCreateInput Child Input object which needs to be added as value for key provided as property name.
 * @param {Object} parentCreateInput Parent Input object for which compoundCreateInput or compoundCreateChange property needs to be updated.
 * @returns {Object} Updated parentCreateInput object
 */
const _updateCompoundCreateValue = function( panelType, propName, childCreateInput, parentCreateInput ) {
    let newParentCreateInput = _.clone( parentCreateInput );
    if ( panelType === 'CREATE' ) {
        // If minimum TC platform version is 142, update compoundCreateChange property of parentCreateInput object.
        // Else, update compoundCreateInput property of parentCreateInput object.
        if( isTCReleaseAtLeast142() ) {
            if ( !newParentCreateInput.compoundCreateChange.hasOwnProperty( propName ) ) {
                newParentCreateInput.compoundCreateChange[propName] = [];
            }
            newParentCreateInput.compoundCreateChange[propName].push( childCreateInput );
        } else {
            if ( !newParentCreateInput.compoundCreateInput.hasOwnProperty( propName ) ) {
                newParentCreateInput.compoundCreateInput[propName] = [];
            }
            newParentCreateInput.compoundCreateInput[propName].push( childCreateInput );
        }
    }
    return newParentCreateInput;
};

/**
   * Private method to create input for create item
   *
   * @param fullPropertyName property name
   * @param count current count
   * @param propertyNameTokens property name tokens
   * @param createInputMap create input map
   * @param operationInputViewModelObject view model object
   * @return {String} full property name
   */
export let addChildInputToParentMap = function( fullPropertyName, propName, parentTypeName, createInputMap, panelType ) {
    var childFullPropertyName = fullPropertyName;
    if ( childFullPropertyName.length > 0 ) {
        childFullPropertyName += '__' + propName; //$NON-NLS-1$
    } else {
        childFullPropertyName += propName;
    }

    // Check if the child create input is already created
    var childCreateInput = _.get( createInputMap, childFullPropertyName );
    if ( !childCreateInput && parentTypeName ) {
        var parentType = cmm.getType( parentTypeName );
        if ( parentType ) {
            // Get the parent create input
            var parentCreateInput = _.get( createInputMap, fullPropertyName );
            if ( parentCreateInput ) {
                // Create the child create input
                // Add the child create input to parent create input
                childCreateInput = exports.getCreateInputObject( parentType.owningType, {}, {}, panelType );
                if ( panelType === 'CREATE' ) {
                    // Update compoundCreateInput or compoundCreateChange property of parentCreateInput.
                    parentCreateInput = _updateCompoundCreateValue( panelType, propName, childCreateInput, parentCreateInput );
                } else {
                    if ( !parentCreateInput.compoundDeriveInput.hasOwnProperty( propName ) ) {
                        parentCreateInput.compoundDeriveInput[propName] = [];
                    }
                    parentCreateInput.compoundDeriveInput[propName].push( childCreateInput );
                }
                createInputMap[childFullPropertyName] = childCreateInput;
            }
        }
    }
    return childFullPropertyName;
};


export let addChildInputToParentMapForCustomPanel = function( fullPropertyName, count, propertyNameTokens, createInputMap, vmProp, panelType ) {
    var propName = propertyNameTokens[count];
    var childFullPropertyName = fullPropertyName;
    if ( count > 0 ) {
        childFullPropertyName += '__' + propName; //$NON-NLS-1$
    } else {
        childFullPropertyName += propName;
    }

    // Check if the child create input is already created
    var childCreateInput = _.get( createInputMap, childFullPropertyName );
    if ( !childCreateInput && vmProp && vmProp.intermediateCompoundObjects ) {
        var compoundObject = _.get( vmProp.intermediateCompoundObjects, childFullPropertyName );
        if ( compoundObject ) {
            // Get the parent create input
            var parentCreateInput = _.get( createInputMap, fullPropertyName );
            if ( parentCreateInput ) {
                // Create the child create input
                // Add the child create input to parent create input
                childCreateInput = exports.getCreateInputObject( compoundObject.modelType.owningType, {}, {}, panelType );
                if ( panelType === 'CREATE' ) {
                    // Update compoundCreateInput or compoundCreateChange property of parentCreateInput
                    parentCreateInput = _updateCompoundCreateValue( panelType, propName, childCreateInput, parentCreateInput );
                } else {
                    if ( !parentCreateInput.compoundDeriveInput.hasOwnProperty( propName ) ) {
                        parentCreateInput.compoundDeriveInput[propName] = [];
                    }
                    parentCreateInput.compoundDeriveInput[propName].push( childCreateInput );
                }
                createInputMap[childFullPropertyName] = childCreateInput;
            }
        }
    }
    return childFullPropertyName;
};


export let processPropertyForCreateInput = function( propName, vmProp, createInputMap, panelType ) {
    if ( vmProp ) {
        var valueStrings = uwPropertyService.getValueStrings( vmProp );
        if ( valueStrings && valueStrings.length > 0 ) {
            var fullPropertyName = '';
            var propertyNameTokens = propName.split( '.' );
            for ( var i = 0; i < propertyNameTokens.length; i++ ) {
                var propertyName = '';
                var parentTypeName = null;
                if ( propertyNameTokens[i].startsWith( 'REF' ) ) {
                    var index = propertyNameTokens[i].indexOf( ',' );
                    propertyName = propertyNameTokens[i].substring( 4, index ).trim();
                    parentTypeName = propertyNameTokens[i].substring( index + 1, propertyNameTokens[i].length - 1 ).trim();
                } else {
                    propertyName = propertyNameTokens[i];
                }

                if ( i < propertyNameTokens.length - 1 ) {
                    // Handle child create inputs
                    fullPropertyName = exports.addChildInputToParentMap( fullPropertyName, propertyName, parentTypeName,
                        createInputMap, panelType );
                } else {
                    // Handle property
                    var createInput = createInputMap[fullPropertyName];
                    if ( createInput ) {
                        var propertyNameValues = {};

                        // If minimum TC platform version is 142, get propertyNameValues form changeRelatedProps property of createInput.
                        // Else, get propertyNameValues from propertyNameValues property of createInput.
                        // Below changes are required as we are supporting two different input structure for platform version above TC142 and below.
                        if ( isTCReleaseAtLeast142() && panelType === 'CREATE' ) {
                            propertyNameValues = createInput.changeRelatedProps;
                        } else {
                            propertyNameValues = createInput.propertyNameValues;
                        }
                        _.set( propertyNameValues, propertyName, valueStrings );
                    }
                }
            }
        }
    }
};

export let processPropertyForCustomPanelInput = function( propName, vmProp, createInputMap, panelType ) {
    if ( vmProp ) {
        var valueStrings = uwPropertyService.getValueStrings( vmProp );
        if ( valueStrings && valueStrings.length > 0 ) {
            var propertyNameTokens = propName.split( '__' );
            var fullPropertyName = '';
            for ( var i = 0; i < propertyNameTokens.length; i++ ) {
                if ( i < propertyNameTokens.length - 1 ) {
                    // Handle child create inputs
                    fullPropertyName = exports.addChildInputToParentMapForCustomPanel( fullPropertyName, i, propertyNameTokens,
                        createInputMap, vmProp, panelType );
                } else {
                    // Handle property
                    var createInput = createInputMap[fullPropertyName];
                    if ( createInput ) {
                        var propertyNameValues = {};

                        // If minimum TC platform version is 142, get propertyNameValues form changeRelatedProps property of createInput.
                        // Else, get propertyNameValues from propertyNameValues property of createInput.
                        // Below changes are required as we are supporting two different input structure for platform version above TC142 and below.
                        if ( isTCReleaseAtLeast142() && panelType === 'CREATE' ) {
                            propertyNameValues = createInput.changeRelatedProps;
                        } else {
                            propertyNameValues = createInput.propertyNameValues;
                        }
                        _.set( propertyNameValues, propertyNameTokens[i], valueStrings );
                    }
                }
            }
        }
    }
};

/**
 * Create input structure for new createAndSubmitChangeObjects SOA introduced in TC14.2
 *
 * @param {Object} createInputMap - Contains createData information of createAndSubmitChangeObjects SOA.
 * @param {Object} data - View Model data object.
 * @param {Object} workflowData - Workflow related information.
 * @param {Object} participantInfo - Participant related information.
 * @returns
 */
const _getCreateInputDataForCreateAndSubmitSOA = function( createInputMap, data, workflowData, participantInfo ) {
    // Set as Active Change.
    let setActive = Boolean( data.setActiveChange.dbValue );

    let participantData = [];

    if ( !data.isSimpleChangeObjectCreation ) {
        // Create Participant data that can be passed to new SOA.
        const updatedParticipantsInfo = participantInfo.participantSectionObjects.filter( participantDetails => {
            return participantDetails.modelObjects.length > 0;
        } );

        participantData = updatedParticipantsInfo.map( participantDetails => {
            const assigneeList = participantDetails.modelObjects.map( assigneeDetails => {
                // Right now we are using uniqueUid as workaroud for duplicate resource pool cases when duplicate
                // resource pools added to one aw-list component then because of uid check in component, there
                // is one issue to render it correctly. So to handle it we update the uid with some random number
                // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                return {
                    type: assigneeDetails.type,
                    uid: assigneeDetails.uniqueUid ? assigneeDetails.uniqueUid : assigneeDetails.uid
                };
            } );
            return {
                internalName: participantDetails.internalName,
                allowMultipleAssignee: participantDetails.selectionModelMode !== 'single',
                assigneeList: assigneeList,
                additionalParticipantData: {}
            };
        } );
    }

    return {
        clientId: 'CreateObject',
        createData: _.get( createInputMap, '' ),
        targetObject: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        relatedData: data.dataToBeRelated,
        pasteProp: '',
        workflowData: workflowData,
        setActive: setActive,
        changeParticipantData: participantData
    };
};


/**
   * Get input data for object creation.
   *
   * @param {Object} data - the view model data object
   * @return {Object} create input
   */
export let getCreateInputFromDerivePanel = function( data, panelType, editHandler, participantInfo ) {
    var createInputMap = {};
    createInputMap[''] = exports.getCreateInputObject( data.creationType, {}, {}, panelType );

    // Clone workflowData before updating.
    const newWorkflowData = _.clone( data.workflowData );

    let objectTypeIn = data.creationType ? '_' + data.creationType : '';
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if ( dataSource ) {
            let allEditableProperties = dataSource.getAllEditableProperties();
            _.forEach( allEditableProperties, function( vmProp ) {
                // Get workflow template information from Input Panel.
                if ( isTCReleaseAtLeast142() && vmProp.propertyName.includes( 'awp0ProcessTemplates' ) ) {
                    let value = uwPropertyService.getValueStrings( vmProp );
                    if( value && value.length > 0 ) {
                        newWorkflowData.templateName = value[0];
                    }
                } else if ( vmProp && ( vmProp.isAutoAssignable || uwPropertyService.isModified( vmProp ) ) ) {
                    exports.processPropertyForCreateInput( vmProp.propertyName, vmProp, createInputMap, panelType );
                }
            } );
        }

        var _fileInputForms = data.fileInputForms;
        if ( !_fileInputForms ) {
            _fileInputForms = [];
        }

        if ( dataSource.getDeclViewModel().customPanelInfo ) {
            _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                // copy custom panel's fileInputForms
                var customFileInputForms = customPanelVMData.fileInputForms;
                if ( customFileInputForms ) {
                    _fileInputForms = _fileInputForms.concat( customFileInputForms );
                }

                // copy custom panel's properties
                var oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                _.forEach( oriVMData, function( propVal, propName ) {
                    if ( _.has( customPanelVMData, propName ) ) {
                        var vmProp = customPanelVMData[propName];
                        if ( propName.includes( '__' ) ) {
                            exports.processPropertyForCustomPanelInput( propName, vmProp, createInputMap, panelType );
                        } else {
                            exports.processPropertyForCreateInput( propName, vmProp, createInputMap, panelType );
                        }
                    }
                } );
            } );
        }

        if ( data.additionalVMProps ) {
            _.forEach( data.additionalVMProps, function( vmProp, propName ) {
                if ( propName.includes( '__' ) ) {
                    exports.processPropertyForCustomPanelInput( propName, vmProp, createInputMap, panelType );
                } else {
                    exports.processPropertyForCreateInput( propName, vmProp, createInputMap, panelType );
                }
            } );
        }
    }

    // If minimum TC platform version is 142, create input structure for new SOA i.e. createAndSubmitChangeObjects.
    // Else, return input structure for old SOA.
    let soaCreateInput = {};
    if( isTCReleaseAtLeast142() && panelType === 'CREATE' ) {
        soaCreateInput = _getCreateInputDataForCreateAndSubmitSOA( createInputMap, data, newWorkflowData, participantInfo );
    } else {
        soaCreateInput = {
            clientId: 'CreateObject',
            createData: _.get( createInputMap, '' ),
            targetObject: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            dataToBeRelated: data.dataToBeRelated,
            pasteProp: '',
            workflowData: newWorkflowData
        };
    }

    return [ soaCreateInput ];
};

/**
   * Updating occmgmt context isChangeEnabled
   *
   * @param {string} changeToggleState true if change is enabled else false.
   */
export let updateCtxWithShowChangeValue = function( changeToggleState ) {
    let contextKey = appCtxSvc.ctx.aceActiveContext.key;
    appCtxSvc.updatePartialCtx( contextKey + '.isChangeEnabled', changeToggleState === 'true' );
    appCtxSvc.updateCtx( 'isRedLineMode', changeToggleState );
    appCtxSvc.updatePartialCtx( 'showChange', changeToggleState === 'true' );
};

/**
   * Check version whether to call new SOA for derive or old SOA. New SOA was introduced in Tc12.3
   *
   * @function callNewSOAForDerive
   *
   */
export let callNewSOAForDerive = function() {
    if ( appCtxSvc.ctx.tcSessionData && ( appCtxSvc.ctx.tcSessionData.tcMajorVersion >= 12 && appCtxSvc.ctx.tcSessionData.tcMinorVersion >= 3 || appCtxSvc.ctx.tcSessionData.tcMajorVersion >= 13 ) ) {
        return true;
    }
    return false;
};

/**
   * Add "No Change Context" List to values
   *
   * @param {Object} response - response of LOV SOA
   */
export let generateChangeContextList = function( data ) {
    var deferedLOV = AwPromiseService.instance.defer();

    // data.dataProviders.changeContextLinkLOV.validateLOV = function() {
    //     // no op
    // };

    lovService.getInitialValues( '', deferedLOV, appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext,
        'Create', appCtxSvc.ctx.userSession, 100, 100, '', '' );

    /**
       * Process response when LOV 'getInitialValues' has been performed.
       */
    return deferedLOV.promise.then( function( response ) {
        if ( response && response.lovValues && response.lovValues.length > 0 ) {
            var resource = 'ChangeMessages';
            var localTextBundle = localeSvc.getLoadedText( resource );
            var noChangecontextString = localTextBundle.noChangeContext;

            //Create an entry for "No Change Context"
            var noChangeContextEntry = JSON.parse( JSON.stringify( response.lovValues[0] ) );
            noChangeContextEntry.propDisplayValue = noChangecontextString;
            noChangeContextEntry.propInternalValue = '';

            response.lovValues.unshift( noChangeContextEntry );
            // Create a LOV with respect to filter value
            return response.lovValues.filter( element => filterSearch( data.filterBox.dbValue, element.propDisplayValue ) );
        }
        return handleChangeContextError( response );
    }, function( response ) {
        return handleChangeContextError( response );
    } );
};

/*
    Handle selection for Active Change LOV value
*/
export let updateActiveChangeSelection = function( dataprovider, activeobject ) {
    var localTextBundle = localeSvc.getLoadedText( 'CreateChangeMessages' );        // Using Locale service for Local text( "noActiveChangeDisplayValue" )
    let indexOfCurrActive = -1;
    let noActiveChangeIndex = -1;

    dataprovider.viewModelCollection.loadedVMObjects.forEach( function( vmo, index ) {
        if ( vmo.propDisplayValue === activeobject.uiValue ) {                               // Get Active Change index
            indexOfCurrActive = index;
        } else if ( vmo.propDisplayValue === localTextBundle.noActiveChangeDisplayValue ) {  // Get "No Active Change" LOV index through Locale services
            noActiveChangeIndex = index;                                                     // Avoid using any language specific text eg."No Active Change"
        }                                                                                    // Use Locale services in that case
    } );
    if( indexOfCurrActive >= 0 ) {
        dataprovider.changeObjectsSelection( indexOfCurrActive, indexOfCurrActive, true );   // Making Selection For LOV
    } else if ( ( activeobject.value === null || activeobject.value === '' ) &&  noActiveChangeIndex >= 0  ) {
        dataprovider.changeObjectsSelection( noActiveChangeIndex, noActiveChangeIndex, true );
    }
};

let handleChangeContextError = ( response ) => {
    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var noChangecontextString = localTextBundle.noChangeContext;

    var noChangeContextEntry = {};
    noChangeContextEntry.propDisplayValue = noChangecontextString;
    noChangeContextEntry.propInternalValue = '';

    var msgObj = {
        msg: '',
        level: 0
    };
    let partialErrors = response.responseData.ServiceData.partialErrors;
    if ( partialErrors.length > 0 ) {
        for ( var x = 0; x < partialErrors[0].errorValues.length; x++ ) {
            if ( partialErrors[0].errorValues[x].code !== 54060 ) {
                msgObj.msg += partialErrors[0].errorValues[x].message;
                msgObj.msg += '<BR/>';
                msgObj.level = _.max( [ msgObj.level, partialErrors[0].errorValues[x].level ] );
            }
        }
    }
    if ( msgObj.msg !== '' ) {
        messagingService.showError( msgObj.msg );
    }
    return [ noChangeContextEntry ];
};
/**
   * Honours CopyFromOriginal Property Constant
   * while populating create panel properties
   * on Derive Change
   *
   * @param {String} data - The view model data
   * @param {String} propToLoad - properties on create panel
   */
export let populateCreatePanelPropertiesOnDerive = function( data, editHandlerIn ) {
    var selectedChangeObjects = appCtxSvc.ctx.mselected;
    var propToLoad = [];
    let objectTypeIn = data.selectedType ? '_' + data.selectedType.dbValue : '';
    let editHandler = editHandlerIn;
    if ( !editHandler ) {
        editHandler = editHandlerService.getEditHandler( 'CREATE_PANEL_CONTEXT' );
    }

    let allEditableProperties = addObjectUtils.getObjCreateEditableProperties( data.selectedType, 'CREATE', null, editHandler );
    _.forEach( allEditableProperties, function( vmProp ) {
        if ( vmProp !== undefined ) {
            propToLoad.push( vmProp.propertyName );
            data[vmProp.propertyName] = vmProp;
        }
    } );

    if ( selectedChangeObjects === null || propToLoad === null ) {
        return;
    }
    var selectedChange = selectedChangeObjects[0];
    var selectedChangeObjRev = cdm.getObject( selectedChange.uid );
    var selectedChangeObjItemUid = selectedChangeObjRev.props.items_tag.dbValues[0];
    dmSvc.getProperties( [ selectedChange.uid, selectedChangeObjItemUid ], propToLoad ).then( function() {
        let updatedProps = [];
        for ( var propIndex in propToLoad ) {
            if ( propToLoad[propIndex] === '' || propToLoad[propIndex] === null ) {
                continue;
            }
            var viewModelProp = propToLoad[propIndex];
            var property = propToLoad[propIndex];
            var matched = property.indexOf( '__' );
            var propertyOnObjType = null;

            if ( matched > -1 ) {
                propertyOnObjType = property.substring( 0, matched );
                property = property.substring( matched + 2, property.length );
            }

            var objectToConsider = cdm.getObject( selectedChange.uid );
            if ( _.isUndefined( objectToConsider.props[property] ) ) {
                objectToConsider = cdm.getObject( selectedChangeObjItemUid );
                if ( _.isUndefined( objectToConsider.props[property] ) ) {
                    continue;
                }
            }

            var isCopyTrue = isCopyFromOriginal( data, propertyOnObjType, property );
            if ( isCopyTrue === true &&
                 ( data[viewModelProp].dbValue === null || data[viewModelProp].dbValue === '' || data[ viewModelProp ].dbValue === 0 || data[ viewModelProp ].dbValue.length === 0 || data[ viewModelProp ].dbValues[0] === null ) ) {
                setValueOnCreatePanel( data, objectToConsider, property, viewModelProp, updatedProps );
            }
        }
        addObjectUtils.assignInitialValues( updatedProps, objectTypeIn, editHandler );
    } );
};
/**
   * checks if CopyFromOriginal Property Constant
   * is set to true for the property of Object/related object
   * for the target object to be created
   *
   * @param {object} data - The view model data
   * @param {String} property - property of Object to be created
   * @param {String} propertyOnObjType - relation of object on which property resides
   */
function isCopyFromOriginal( data, propertyOnObjType, property ) {
    var typeName;
    if ( propertyOnObjType !== null && propertyOnObjType === 'revision' ) {
        typeName = data.selectedType.dbValue + 'Revision';
    } else {
        typeName = data.selectedType.dbValue;
    }
    var objCreateModelType = cmm.getType( typeName );
    if ( objCreateModelType === null ) {
        typeName += 'CreI';
        objCreateModelType = cmm.getType( typeName );
    }
    if ( objCreateModelType === null ) {
        return false;
    }
    var propDescriptor = objCreateModelType.propertyDescriptorsMap[property];
    if ( _.isUndefined( propDescriptor ) ) {
        return false;
    }
    var propConstantMap = propDescriptor.constantsMap;
    var isCopyFromOrigin = propConstantMap.copyFromOriginal;
    if ( isCopyFromOrigin !== null && isCopyFromOrigin === '1' ) {
        return true;
    }
    return false;
}

/**
   * gets value of property from source object
   * and sets it on the create panel for the object to be created
   *
   * @param {object} data - The view model data
   * @param {object} selectedChange - source change object
   * @param {String} property - property of Object to be created
   * @param {String} viewModelProp - view model property for the object
   */
function setValueOnCreatePanel( data, selectedChange, property, viewModelProp, updatedProps ) {
    var propertyVal = null;
    if ( selectedChange !== null && !_.isUndefined( selectedChange.props[property].dbValue ) ) {
        propertyVal = selectedChange.props[property].dbValue;
    } else if ( selectedChange !== null && !_.isUndefined( selectedChange.props[property].dbValues ) && propertyVal === null ) {
        propertyVal = selectedChange.props[property].dbValues[0];
    }
    if ( _.isUndefined( data[viewModelProp] ) || propertyVal === null ) {
        return;
    }

    data[viewModelProp].dbValue = propertyVal;
    data[viewModelProp].valueUpdated = true;

    if ( data[viewModelProp].hasLov === true ) {
        data[viewModelProp].dbValues = selectedChange.props[property].dbValues;
        data[viewModelProp].displayValues = selectedChange.props[property].displayValues;
        data[viewModelProp].uiValues = selectedChange.props[property].uiValues;
        data[viewModelProp].displayValsModel = selectedChange.props[property].displayValsModel;

        // Fix for defect LCS-683790, Multiselect LOV property uiValue and dbValue was not getting populated.
        // And for same reason was not showing in Derive Change panel correctly.
        if( data[ viewModelProp ].isArray === true ) {
            data[ viewModelProp ].dbValue = data[ viewModelProp ].dbValues;
            data[ viewModelProp ].uiValue = selectedChange.props[ property ].uiValues.join( ', ' );
        } else if ( !data[ viewModelProp ].uiValue && !_.isUndefined( selectedChange.props[ property ].uiValues ) ) {
            data[ viewModelProp ].uiValue = selectedChange.props[ property ].uiValues[0];
        }
    }
    updatedProps.push( data[viewModelProp] );
}

export let sendEventToHost = function( data ) {
    if ( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        var createIssueFromVisMode = appCtxSvc.getCtx( 'CreateIssueHostedMode' );
        if ( createIssueFromVisMode ) {
            if ( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'in sendEventToHost and CreateIssueHostedMode ctx exists.' );
            }
            eventBus.publish( 'changeObjectCreated', data );
        }

        var curHostedComponentId = appCtxSvc.getCtx( 'aw_hosting_state.currentHostedComponentId' );
        if ( curHostedComponentId === 'com.siemens.splm.client.change.CreateChangeComponent' ) {
            if ( data.createdChangeObject !== null ) {
                var uid = data.createdChangeObject.uid;
                var feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();
                var objectRef = objectRefSvc.createBasicRefByModelObject( data.createdChangeObject );
                feedbackMessage.setFeedbackTarget( objectRef );
                feedbackMessage.setFeedbackString( 'ECN  Successfully created' );
                var feedbackProxy = hostFeedbackSvc.createHostFeedbackProxy();
                feedbackProxy.fireHostEvent( feedbackMessage );
            }
        }
    }
};

export let getAdaptedObjectsForSelectedObjects = function( selectedObjects ) {
    var adaptedObjects = adapterService.getAdaptedObjectsSync( selectedObjects );
    if ( adaptedObjects !== null ) {
        return adaptedObjects;
    }

    return selectedObjects;
};

/**
   * This method sets the createInput fnd0contextProvider.
   * @param { Boolean } data: viewModel for create/Add panel
   */
export function updateChangeContextProviderForCreate( data ) {
    if ( appCtxSvc.getCtx( 'pselected.changeContextProvider' ) !== undefined ) {
        let changeContextObjectUid = appCtxSvc.getCtx( 'pselected.changeContextProvider' );
        data.revision__fnd0ContextProvider.dbValue = changeContextObjectUid;
        data.revision__fnd0ContextProvider.dbValues = changeContextObjectUid;
    }
}
/**
   * Check the uid in extraAttachementWithRelations,
   * find the secondary object for the UID .Also
   * get the relation name.Pass this information , along with primary
   * derived object to relation info.
   *
   * @param {*} data
   */
export let getVisAttachmentData = function( data ) {
    var visAttachmentInfo = [];
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;

    // FORMAT of extraAttachementWithRelations: QYUIxtYAG:CMHasProblemItem
    // i.e. uid:relationName
    var visExtraAttachs = currentCtx.extraAttachementWithRelations;
    var secondaryObjUids = data.attachmentsUids;
    var derivedChangeObj = cdm.getObject( data.derivedObjectUid );
    for ( var inx = 0; inx < secondaryObjUids.length; inx++ ) {
        if ( visExtraAttachs[secondaryObjUids[inx]] === null ) {
            continue;
        }
        var secondaryObjects = data.attachments;
        // check if secondary object uid is present in extraAttachementWithRelations
        // if yes, find the relation.
        for ( var ijx = 0; ijx < secondaryObjects.length; ijx++ ) {
            if ( secondaryObjects[ijx].uid === secondaryObjUids[inx] ) {
                var visRelation = visExtraAttachs[secondaryObjUids[inx]];
                if ( visRelation !== null ) {
                    var relationInfo = {
                        relationType: visRelation,
                        primaryObject: derivedChangeObj,
                        secondaryObject: secondaryObjects[ijx]
                    };
                    visAttachmentInfo.push( relationInfo );
                    break;
                }
            }
        }
    }
    return visAttachmentInfo;
};
/**
   * Populate Implements Section of Derive Panel
   * @param {*} selectedChangeObjects
   * @param {*} declViewModel
   */
export let populateImplementsSection = function( selectedChangeObjects, declViewModel ) {
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;
    if ( currentCtx.clientId !== '' ) {
        declViewModel.dataProviders.getImplements.update( selectedChangeObjects,
            selectedChangeObjects.length );
    } else if ( declViewModel.attachments !== undefined && declViewModel.attachments !== null ) {
        declViewModel.dataProviders.getImplements.update( declViewModel.attachments,
            declViewModel.attachments.length );
    }
};
/**
   * Get Initial Change Types for Derive Panel
   * @param {*} initialTypes
   * @param {*} selectedChangeObjects
   */
export let getInitialChangeTypesForDerivePanel = function( initialTypes, selectedChangeObjects ) {
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;
    // Default to specific Change Type for Derived Panel based on
    // input sent (exactTypeToCreate) from visualization
    if ( currentCtx.exactTypeToCreate !== '' && currentCtx.clientId !== '' ) {
        var allInitialTypes = selectedChangeObjects[0].props.cm0DerivableTypes.dbValues;
        for ( var inx = 0; inx < allInitialTypes.length; inx++ ) {
            var changeType = allInitialTypes[inx].substring( 0, allInitialTypes[inx].indexOf( '/' ) );
            if ( changeType === currentCtx.exactTypeToCreate ) {
                initialTypes.push( allInitialTypes[inx] );
                break;
            }
        }
    } else {
        initialTypes = selectedChangeObjects[0].props.cm0DerivableTypes.dbValues;
        for ( var k = 1; k < selectedChangeObjects.length; k++ ) {
            var derivableTypes = selectedChangeObjects[k].props.cm0DerivableTypes.dbValues;
            var commonTypes = _.intersection( initialTypes, derivableTypes );
            initialTypes = commonTypes;
        }
    }

    return initialTypes;
};

/**
   * populating dataToBeRelated for createRelateAndSubmitObjects SOA call input
   * @param {*} parentData
   * @param {*} data
   */
export let populateDataToBePopulated = function( parentData, data ) {
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;
    // for Visualization use-cases where secondary objects are related with specific relations
    // dataToBeRelated will have relation name & secondaryobject uid
    // e.g. dataToBeRelated= {
    //  rel1:UID1
    //  rel2:UID2 }

    if ( currentCtx !== undefined && currentCtx.extraAttachementWithRelations !== undefined
         && Object.keys( currentCtx.extraAttachementWithRelations ).length !== 0 ) {
        var extraAttachments = currentCtx.extraAttachementWithRelations;
        var parentUids = parentData.attachmentsUids;
        data.dataToBeRelated = {};
        for ( var inx = 0; inx < parentUids.length; inx++ ) {
            var relation = extraAttachments[parentUids[inx]];
            var uids = [];
            if ( data.dataToBeRelated[relation] ) {
                uids = data.dataToBeRelated[relation];
            }

            uids.push( parentUids[inx] );
            data.dataToBeRelated[relation] = uids;
        }
    } else if ( parentData.attachmentsUids ) {
        data.dataToBeRelated = {
            '': parentData.attachmentsUids
        };
    }

    if ( isTCReleaseAtLeast142() && parentData.dataProviders.getAssignedProjectsProvider.viewModelCollection.loadedVMObjects
        && parentData.dataProviders.getAssignedProjectsProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        const projects = parentData.dataProviders.getAssignedProjectsProvider.viewModelCollection.loadedVMObjects;
        data.dataToBeRelated.projects = projects.map( projObject => projObject.uid );
    }
};

/**
   * Get the supported SOA to get the change summary data based on tc server release.
   * If tc server is based on tc12 then we need to call old SOA else new SOA.
   * @param {Object} ctx App context object
   *
   * @returns { Object} Object with supported service name and operation name
   */
export let getSupportedChangeSummarySOA = function( ctx ) {
    if ( !ctx || !ctx.tcSessionData || ctx.tcSessionData.tcMajorVersion < 13 ) {
        return {
            serviceName: 'Internal-CmAws-2018-12-Changes',
            operationName: 'getChangeSummaryData'
        };
    }
    return {
        serviceName: 'Internal-CmAws-2021-06-Changes',
        operationName: 'getChangeSummaryData2'
    };
};

/**
   * Get the input key value from additional data and return the correct value accordingly.
   * If AW server is based on tc13x, then to render change summary table we will be calling
   * getChangeSummaryData2 and this SOA returns all values in additionalData object and
   * right now it supports these keys isOddRow,hasChildren,isCompareRow, isAbsOccInContextParent.
   * Key isAbsOccInContextParent is used to render the changes for incontext only. This key will
   * be returned from server when platform version is tc13.2 or more. In olde release this key
   * value will not be returned.
   * If AW server is based on tc12x, then to render change summary table we will be calling
   * getChangeSummaryData and this SOA returns all values in dataObject object and
   * right now it supports these keys isOddRow,hasChildren,isCompareRow.
   *
   *
   * @param {Object} dataObject Data obejct that store all info returned from server
   * @param {String} keyName Key name that need to be fetched from additional data object
   * @param {boolean} isBooleanPropValue True/False based on that proeprty return value will be either
   *                  boolean or string.
   *
   * @param {Object} Object Property return value got from additional data
   */
export let getAdditionalDataValue = function( dataObject, keyName, isBooleanPropValue ) {
    if ( dataObject && dataObject.additionalData && dataObject.additionalData[keyName] ) {
        var keyValues = dataObject.additionalData[keyName];
        if ( keyValues && keyValues[0] ) {
            var propValue = keyValues[0];
            var returnPropValue = keyValues[0];
            if ( isBooleanPropValue && propValue ) {
                returnPropValue = propValue.toLowerCase() === 'true';
            }
            return returnPropValue;
        }
    } else if ( dataObject && dataObject.hasOwnProperty( keyName ) ) {
        return dataObject[keyName];
    }
    if ( isBooleanPropValue ) {
        return false;
    }
    return null;
};

/**
   * Get the change summary soa input data.
   *
   * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
   * @param {Object} ctx App context object
   * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
   *
   * @return {Object} Input data to call SOA
   */
export let getChangeSummaryInputData = function( ctx, treeLoadInput, dataProvider, isGenealogy ) {
    // getChangeSummaryData requires following input
    // 1. changeNoticeRevision - Selected ChangeNoticeRevision
    // 2. selectedRow - Selected Object from Change Summary table( In case of expanding parent )
    // 3. isOddRowSelected - Flag to indicate whether selected row is rendered as odd background color or even background color.
    //                       Based on this background color flag for child row is calculated on server.
    // 4. startIndex - StartIndex for next page. Change Summary table pagination at first level.
    // 5. pageSize - Number of objects should be returned per SOA call. Change Summary Table only support pagination at first level.
    var changeNoticeRevision = appCtxSvc.getCtx( 'xrtSummaryContextObject' ).uid;

    var selectedRow = ''; // Selected row in case of expanding parent
    var isOddRowSelected = false; // if we are displaying change summary table first time ( not-expanding parent, isOddRowSelected is passed as false. )
    var isAbsOccInContextParent = false;
    if ( treeLoadInput.parentNode.levelNdx > -1 ) {
        selectedRow = treeLoadInput.parentNode.uid;
        isOddRowSelected = treeLoadInput.parentNode.isOdd;
        isAbsOccInContextParent = treeLoadInput.parentNode.isAbsOccInContextParent;
    }

    // we can't reply on treeLoadInput.startIndexForNextPage to retrive next page of data. Change Summary table contains group of rows in case of replace.
    // So number of row displayed will be more than number of loaded solutions available in ChangeNoticeRevision.
    // And hence maintaining same variable on data provider which will provide index of net page.
    var isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    var startIndexForNextPage = 0;
    if ( isTopNode && dataProvider.startIndexForNextPage ) {
        startIndexForNextPage = dataProvider.startIndexForNextPage;
    }

    var inputData = {
        changeNoticeRevision: changeNoticeRevision,
        isOddRowSelected: isOddRowSelected,
        startIndex: startIndexForNextPage,
        pageSize: treeLoadInput.pageSize
    };

    if( isGenealogy && selectedRow === '' ) {
        inputData.inputObject = getBomLine( ctx.selected.uid );
    } else if ( ctx.tcSessionData && ctx.tcSessionData.tcMajorVersion >= 13 ) {
        inputData.inputObject = selectedRow;
    } else {
        inputData.selectedRow = selectedRow;
    }

    // Check if this is true then we need to pass AbsOcc in context info to SOA so that
    // server will send info only for incontext changes
    if ( isAbsOccInContextParent ) {
        inputData.additionalData = {
            isAbsOccInContextParent: [ 'true' ]
        };
    }

    // If this is a genalogy operation
    // send need info to the server for first and child levels
    if ( isGenealogy ) {
        if( selectedRow !== '' ) {
            inputData.additionalData = {
                retrieveGenealogy: [ 'true' ],
                retrieveGenealogyChildren: [ 'true' ],
                selectedBomLine: [ getBomLine( ctx.selected.uid ).uid ]
            };
        } else {
            inputData.additionalData = {
                retrieveGenealogy: [ 'true' ]
            };
        }
    }

    return inputData;
};

/**
 * Get BOMLine out of element
 * @return {parent} element object
 */
function getBomLine( parentUid ) {
    var uid = parentUid.match( 'BOMLine(.*),' );
    if( !uid ) {
        uid = parentUid.match( 'Cm0RemovedLine(.*),' );
    }
    uid = 'SR::N::' + uid[ 0 ].replace( ',,', '' );
    return new IModelObject( uid, 'BOMLine' );
}

var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

export let populateChangeContext = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var openedItemRevisionUid = appCtxSvc.ctx.aceActiveContext.context.openedElement.props.awb0UnderlyingObject.dbValues[0];
    var openedItemRevision = cdm.getObject( openedItemRevisionUid );
    var ecnForOpenedElementUid = openedItemRevision.props.cm0AuthoringChangeRevision.dbValues[0];

    if ( appCtxSvc.ctx.aceActiveContext.context.supportedFeatures.Awb0RevisibleOccurrenceFeature && appCtxSvc.ctx.aceActiveContext.context.supportedFeatures.Awb0RevisibleOccurrenceFeature === true ) {
        ecnForOpenedElementUid = '';
        ecnForOpenedElementUid = appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext.dbValue;
    }

    if ( ecnForOpenedElementUid !== null && ecnForOpenedElementUid !== '' ) {
        dmSvc.getProperties( [ ecnForOpenedElementUid ], [ 'object_string' ] ).then( function() {
            var ecnVMO = cdm.getObject( ecnForOpenedElementUid );
            if ( ecnVMO !== null && ecnVMO !== undefined ) {
                data.changeContextValue = {
                    type: 'OBJECT',
                    isNull: false,
                    uiValue: ecnVMO.props.object_string.dbValues[0],
                    dbValue: ecnForOpenedElementUid
                };
                appCtxSvc.ctx.ecnForOpenedElement = ecnVMO;
            }
            deferred.resolve();
        } );
    }

    return deferred.promise;
};
/**
   * Get logical value from string value
   * @param {*} stringValue
   */
export let isPropertyValueTrue = function( stringValue ) {
    return stringValue && stringValue !== '0' &&
         ( String( stringValue ).toLowerCase === 'true' || stringValue === '1' );
};
/**
  * Output function for getTypeConstantValues SOA.
  * OutputData is as a structure of properties
  * corresponding each property to updated business constant values
  * @param {*} response
  * @param {*} data
  */
export let outputForBOTypeConstant = function( response, data ) {
    let newBoTypeConst = _.clone( data.boTypeConst );
    if ( response && response.constantValues && response.constantValues.length > 0 ) {
        for ( var i = 0; i < response.constantValues.length; i++ ) {
            var responseConstantName = response.constantValues[i].key.constantName;
            var responseConstantValue = response.constantValues[i].value;

            if ( responseConstantValue === 'false' ) {
                if ( responseConstantName === 'Awp0EnableSubmitForCreate' ) {
                    newBoTypeConst.showSubmitButton.dbValue = false;
                } else if ( responseConstantName === 'Awp0EnableCreateForCreatePanel' ) {
                    newBoTypeConst.showCreateButton.dbValue = false;
                } else if ( responseConstantName === 'Fnd0EnableAssignProjects' ) {
                    newBoTypeConst.isEnableAssignProjects.dbValue = false;
                }
            }
            // For simple change this button should not be visible.
            if ( data.isSimpleChangeObjectCreation && responseConstantName === 'Awp0EnableCreateForCreatePanel' ) {
                newBoTypeConst.showCreateButton.dbValue = false;
            }
        }
    }
    return newBoTypeConst;
};

/**
  * Returns true if dispName contains filterString
  * @param {String} filterString
  * @param {String} dispName
  * @returns
  */
export let filterSearch = function( filterString, dispName ) {
    let hasWildcardChar = /[%*]/g;
    if( hasWildcardChar.test( filterString ) ) {
        var wildcrdRegex = new RegExp( filterString.replace( /[%*]/ig, '.*' ), 'ig' );
        if( wildcrdRegex.test( dispName ) ) {
            return true;
        }
    } else if( dispName.toLowerCase().indexOf( filterString.toLowerCase() ) > -1 ) {
        return true;
    }
    return false;
};

/**
  * open create change panel with change type
  * @param {String} changeType
  */

export let openCreateChangeOnTypePanel = function( changeType ) {
    let ctx = appCtxSvc.ctx;
    const createChangeData = {
        typeNameToCreate : changeType //changeType
    };
    appCtxSvc.registerCtx( 'appCreateChangePanel', createChangeData );
    Cm1ChangeCommandService.openCreateChangePanel( 'Cm1ShowCreateChange', 'aw_toolsAndInfo', ctx.state.params );
};

/**
 * Check if minimum platform version is TC 14.2 or not.
 * @param {Object} ctx Context object
 * @return {Boolean} returns true, if minimum platform version is TC142.
 */
export let isTCReleaseAtLeast142 = function( ctx ) {
    // Check if undefined then use it from service
    if( !ctx ) {
        ctx = appCtxSvc.ctx;
    }
    if( ctx && ctx.tcSessionData && (  ctx.tcSessionData.tcMajorVersion === 14 && ctx.tcSessionData.tcMinorVersion >= 2  || ctx.tcSessionData.tcMajorVersion > 14 ) ) {
        return true;
    }
    return false;
};

export default exports = {
    getReviseInputsJs,
    getCreateInputObject,
    addChildInputToParentMap,
    processPropertyForCreateInput,
    getCreateInputFromDerivePanel,
    updateCtxWithShowChangeValue,
    callNewSOAForDerive,
    generateChangeContextList,
    populateCreatePanelPropertiesOnDerive,
    sendEventToHost,
    getAdaptedObjectsForSelectedObjects,
    updateChangeContextProviderForCreate,
    getVisAttachmentData,
    populateImplementsSection,
    getInitialChangeTypesForDerivePanel,
    populateDataToBePopulated,
    getSupportedChangeSummarySOA,
    populateChangeContext,
    getAdditionalDataValue,
    getChangeSummaryInputData,
    isPropertyValueTrue,
    processPropertyForCustomPanelInput,
    addChildInputToParentMapForCustomPanel,
    outputForBOTypeConstant,
    filterSearch,
    updateActiveChangeSelection,
    openCreateChangeOnTypePanel,
    isTCReleaseAtLeast142
};
