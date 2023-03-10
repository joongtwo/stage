/* eslint-disable max-lines */
// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Module for the Import BOM panel
 *
 * @module js/importBOMService
 */

import msgSvc from 'js/messagingService';
import uwPropertyService from 'js/uwPropertyService';
import appCtxSvc from 'js/appCtxService';
import notyService from 'js/NotyModule';
import eventBus from 'js/eventBus';
import importPreviewSetActionOnLine from 'js/importPreviewSetActionOnLine';
import localeService from 'js/localeService';
import _ from 'lodash';
import 'js/listBoxService';

let exports = {};
let localeTextBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
let ADD_NEW_INTERNAL = 'add_new';

/**
 * It disables Import Structure button in panel when import operation is in progress.
 */
export let registerExcelData = function() {
    appCtxSvc.registerCtx( 'awb0ImportFromExcelProgressing', true );
};

/**
 * This API reset awb0ImportFromExcelProgressing flag in context to make
 * sure Import Structure button gets enabled whenever import operation fails.
 */
export let enableImportStructureButtonInPanel = function() {
    appCtxSvc.updateCtx( 'awb0ImportFromExcelProgressing', false );
};

/**
 * Unregister the flags from view model data for excel import
 */
export let unRegisterExcelData = function() {
    appCtxSvc.updateCtx( 'awb0ImportFromExcelProgressing', false );
    if( appCtxSvc.getCtx( 'isAwb0ImportFromExcelSubPanelActive' ) ) {
        appCtxSvc.unRegisterCtx( 'isAwb0ImportFromExcelSubPanelActive' );
    }
};

/**
 * Updates view model according to file selected
 * @param {Object} fileName - Name of selected file
 *
 */
export let updateFormData = function( fileName, fileNameNoExt, validFile, formData ) {
    if( validFile ) {
        if( fileName && fileName !== '' ) {
            // In Preview mode, on choosing a different input file, unregister preview context
            let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
            if( importBOMContext !== undefined ) {
                appCtxSvc.unRegisterCtx( 'ImportBOMContext' );
            }
            unRegisterExcelData();
            if( !appCtxSvc.getCtx( 'isAwb0ImportFromExcelSubPanelActive' ) ) {
                appCtxSvc.registerCtx( 'isAwb0ImportFromExcelSubPanelActive', true );
            }
            eventBus.publish( 'importBOM.startPostFileUploadProcess' );
        }
    } else if( fileName ) {
        let resource = 'OccmgmtImportExportConstants';
        let localTextBundle = localeService.getLoadedText( resource );
        let localizedMsg = localTextBundle.invalidFileExtension;
        msgSvc.showError( localizedMsg );
    }

    return {
        fileName,
        fileNameNoExt,
        validFile,
        formData
    };
};

/**
 * Reset Data from import from excel panel.
 *
 * @param {Object} data - The view model data
 *
 */
export let resetExcelImportData = function( data, sharedData = {} ) {
    let mappingGroupCopy = _.clone( data.mappingGroup );
    mappingGroupCopy.dbValue = '';
    mappingGroupCopy.uiValue = '';
    mappingGroupCopy.dbValues = '';
    mappingGroupCopy.uiValues = '';
    mappingGroupCopy.dbOriginalValue = '';
    mappingGroupCopy.uiOriginalValue = '';
    const newSharedData = { ...sharedData.value };
    newSharedData.typePropInfos = [];
    sharedData.update && sharedData.update( newSharedData );
    return {
        showPropertiesMap: false,
        isAwb0ImportButtonIsVisible: false,
        columnHeaders: [],
        secTypePropInfos: [],
        objectSubTypes: [],
        viewModelPropertiesForHeader: [],
        mappingGroup: mappingGroupCopy
    };
};

/**
 * This API appends " (Required)" into display name if property is a required.
 * @param {*} propInfo - property info
 * @param {*} objectTypeInfo - Type of object (part,item etc)
 * @param {*} requiredString - i18n string for required properties
 * @returns {String} - property display name
 */
let appendRequiredStringForRequiredProperty = function( propInfo, objectTypeInfo, requiredString ) {
    if( propInfo.isRequired ) {
        if( propInfo.isSecondaryObject ) {
            return objectTypeInfo.propDisplayValue + ':' + propInfo.dispPropName + requiredString;
        }
        return propInfo.dispPropName + requiredString;
    }
    return propInfo.dispPropName;
};

/**
 * Create view model property for the property info
 * @param {Object} objectTypeInfo - Type of object (part,item etc)
 * @param {Object} propInfo - Property info
 * @returns {Object} viewModelObject - view model object for the given property info
 */
let createViewModelObjectForProperty = function( objectTypeInfo, propInfo ) {
    let dispPropName = appendRequiredStringForRequiredProperty( propInfo, objectTypeInfo, localeTextBundle.required );
    let viewProp = uwPropertyService.createViewModelProperty( objectTypeInfo.propInternalValue + '.' + propInfo.realPropName, dispPropName, 'BOOLEAN', [], [] );
    if( propInfo.isSecondaryObject ) {
        viewProp.isSecondaryObject = propInfo.isSecondaryObject;
    }
    uwPropertyService.setIsRequired( viewProp, propInfo.isRequired );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_RIGHT' );
    if( viewProp.isRequired ) {
        uwPropertyService.setValue( viewProp, true );
        uwPropertyService.setIsEnabled( viewProp, false );
    } else {
        uwPropertyService.setValue( viewProp, false );
        uwPropertyService.setIsEnabled( viewProp, true );
    }
    // attributes required to show property in lov
    viewProp.propDisplayValue = viewProp.propertyDisplayName;
    viewProp.propInternalValue = viewProp.propertyName;
    return viewProp;
};

/**
 * API created the Right side labels of our panel
 * @param {*} data
 */
let createPropertyLabelsOnTheRight = function( typePropInfos ) {
    let objectSubTypes = [];
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        let objectType = {
            propDisplayValue: typePropInfo.dispTypeName,
            propInternalValue: typePropInfo.objectType
        };
        objectSubTypes.push( objectType );
        let propInfos = typePropInfo.propInfos;
        for( let propInfoIdx = 0; propInfoIdx < propInfos.length; propInfoIdx++ ) {
            propInfos[ propInfoIdx ] = createViewModelObjectForProperty( objectType, propInfos[ propInfoIdx ] );
        }
        _sortBooleanList( propInfos );
    }
    return objectSubTypes;
};

/**
 * If index is 0 then prop Info is a primary object and if it is 1 then it is secondary object
 * @param {*} propInfo property info
 * @param {*} typeInfo type Info object
 * @param {*} index index of response array
 */
let setObjectTypeOnObject = function( propInfo, typeInfo, index ) {
    if( index === 1 ) {
        if( propInfo ) {
            propInfo.isSecondaryObject = true;
        }
        if( typeInfo ) {
            _.forEach( typeInfo.propInfos, function( propInfo ) {
                propInfo.isSecondaryObject = true;
            } );
        }
    }
};

/**
 * Create view model property for the header
 *
 * @param {Object} header - Header string
 * @returns {Object} viewModelObject - view model object for the given header
 */
let createViewModelPropertyForHeader = function( header ) {
    // Create the viewModel property for the given attribute type.
    let viewProp = uwPropertyService.createViewModelProperty( header, header, 'STRING', [], [] );
    viewProp.editLayoutSide = true;
    uwPropertyService.setHasLov( viewProp, true );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEnabled( viewProp, true );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
    viewProp.dataProvider = 'LOVDataProvider';
    return viewProp;
};

/**
 * Populates following on data from server response.
 * 1) Type prop info
 * 2) Column Headers
 * 3) Secondary column headers
 * 4) Secondary type prop Info
 * @param {*} data data received from server
 */
let populatePropInfoAndTypeInfoMap = function( data ) {
    let VMPropForHeader = [];
    let columnHeaders = [];
    let typePropInfos = [];
    let secTypePropInfos = [];
    for( let index = 0; index < data.mappingGroupResponse.mappingOutputs.length; index++ ) {
        let mappingOutput = data.mappingGroupResponse.mappingOutputs[ index ];
        _.forEach( mappingOutput.propInfos, function( propInfo ) {
            setObjectTypeOnObject( propInfo, undefined, index );
            let viewProp = createViewModelPropertyForHeader( propInfo.propHeader );
            if( propInfo.isSecondaryObject ) {
                viewProp.isSecondaryObject = propInfo.isSecondaryObject;
            }
            VMPropForHeader.push( viewProp );
            columnHeaders.push( propInfo.propHeader );
        } );
        _.forEach( mappingOutput.typePropInfos, function( typePropInfo ) {
            setObjectTypeOnObject( undefined, typePropInfo, index );
            typePropInfos.push( typePropInfo );
        } );
        if( index === 1 ) {
            _.forEach( mappingOutput.typePropInfos, function( typePropInfo ) {
                secTypePropInfos.push( typePropInfo );
            } );
        }
    }
    return {
        VMPropForHeader,
        columnHeaders,
        typePropInfos,
        secTypePropInfos
    };
};

/**
 * Update Properties with selected properties
 * @param {Object} data - The view model data
 */
export let updatePropertiesForMapping = function( typePropInfos ) {
    let propertiesForMapping = [];
    // Get selected properties
    for( let typePropInfoIndex = 0; typePropInfoIndex < typePropInfos.length; typePropInfoIndex++ ) {
        let typePropInfo = typePropInfos[ typePropInfoIndex ];
        let propInfos = typePropInfo.propInfos;
        for( let propInfoIndex = 0; propInfoIndex < propInfos.length; propInfoIndex++ ) {
            let propInfo = propInfos[ propInfoIndex ];
            // Add required/selected properties to the list
            if( propInfo.dbValue ) {
                propertiesForMapping.push( propInfo );
            }
        }
    }
    return propertiesForMapping;
};

/**
 * API process server response and populates all the maps it required for validation and processing od request
 * Get headers and properties from response data.
 * @param {Object} data - The view model data
 */
export let createPropertiesMap = function( data, sharedData = {} ) {
    let showPropertiesMap = true;
    let { VMPropForHeader, columnHeaders, typePropInfos, secTypePropInfos } = populatePropInfoAndTypeInfoMap( data );
    // Create view model properties for properties
    let objectSubTypes = createPropertyLabelsOnTheRight( typePropInfos );
    const newSharedData = { ...sharedData.value };
    newSharedData.typePropInfos = typePropInfos;
    sharedData.update && sharedData.update( newSharedData );

    let propertiesForMapping = exports.updatePropertiesForMapping( typePropInfos );
    return {
        showPropertiesMap,
        VMPropForHeader,
        columnHeaders,
        secTypePropInfos,
        objectSubTypes,
        propertiesForMapping
    };
};

/**
 * Every time we load new mapping, we need to destroy existing header view model properties and recreate them
 * to make sure UI works consistently.
 * @param {Object} data - Declarative View Model Object
 * @returns {Object} - VMOs for excel header mapper with empty values (reset)
 */
let destroyExistingVMOAndReCreateVMOForHeaders = function( data ) {
    let newViewModelPropertiesForHeader = [];
    for( let index = 0; index < data.columnHeaders.length; index++ ) {
        let header = data.columnHeaders[ index ];
        let viewProp = createViewModelPropertyForHeader( header );
        viewProp.isSecondaryObject = data.viewModelPropertiesForHeader[ index ].isSecondaryObject;
        newViewModelPropertiesForHeader.push( viewProp );
    }
    return newViewModelPropertiesForHeader;
};

/**
 * API reads server response and populates all the saved mapping values in LOV view model properties.
 * @param {Object} propsFromServer - saved mapping's mapped properties
 * @param {Object} newViewModelPropertiesForHeader - VMOs for excel header mapper
 *
 */
let populateValueInLOVFromServerResponse = function( propsFromServer, newViewModelPropertiesForHeader ) {
    for( let headerVMOIndex = 0; headerVMOIndex < newViewModelPropertiesForHeader.length; headerVMOIndex++ ) {
        let headerViewModelProp = newViewModelPropertiesForHeader[ headerVMOIndex ];
        for( let propInfoIndex = 0; propInfoIndex < propsFromServer.length; propInfoIndex++ ) {
            let propInfoFromResp = propsFromServer[ propInfoIndex ];
            if( headerViewModelProp.propertyName === propInfoFromResp.propHeader ) {
                headerViewModelProp.dbValue = propInfoFromResp.realPropName;
                headerViewModelProp.uiValue = propInfoFromResp.dispPropName;
                break;
            }
        }
    }
};

/**
 * API iterates over all the header view model properties and set modifiablity flag as per server response.
 * @param {*} selectedMappingGroup - mapping selected from Saved Mappings list
 * @param {*} newViewModelPropertiesForHeader - VMOs for excel header mapper
 */
let setModifiabilityOnHeaderVMProp = function( selectedMappingGroup, newViewModelPropertiesForHeader ) {
    for( let indexOfHeaderVMP = 0; indexOfHeaderVMP < newViewModelPropertiesForHeader.length; indexOfHeaderVMP++ ) {
        newViewModelPropertiesForHeader[ indexOfHeaderVMP ].isEnabled = selectedMappingGroup.isModifiable;
    }
};

/**
 * This API takes value from server property info and populates them in corresponding header property info. If populated property is required then we add
 * (Required) string in its label.
 *
 * @param {*} propInfoFromTypeInfoMap : This prop info comes from type Prop info list. It has all the meta data of all the properties of loaded business objects
 * @param {*} newViewModelPropertiesForHeader : VMOs for excel header mapper
 * @param {*} propInfoFromServer propInfo coming from server which could have value which needs to be populated in header view model property
 */
let updateValuesInHeaderVMOAsPerValuesComingFromServer = function( propInfoFromTypeInfoMap, newViewModelPropertiesForHeader, propInfoFromServer ) {
    if( propInfoFromTypeInfoMap.isRequired ) {
        for( let headerVMPropIndex = 0; headerVMPropIndex < newViewModelPropertiesForHeader.length; headerVMPropIndex++ ) {
            let headerVMProp = newViewModelPropertiesForHeader[ headerVMPropIndex ];
            if( headerVMProp.uiValue === propInfoFromServer.dispPropName ) {
                // Add required/selected properties to the list
                headerVMProp.uiValue += localeTextBundle.required;
            }
        }
    }
};

/**
 * API checks whether incoming property already exist in propertiesForMapping map or not. If it exists then we do not add it otherwise we
 * add it in properties for mapping array.
 * @param {*} propertiesForMapping Current properties to be mapped list
 * @param {*} propInfoFromTypeInfoMap propInfo which need to be added it already not available in propertiesForMapping map.
 */
let updateDataPropertyMapping = function( propertiesForMapping, propInfoFromTypeInfoMap ) {
    let isPropExist = false;
    for( let index = 0; index < propertiesForMapping.length; index++ ) {
        let existingProperty = propertiesForMapping[ index ];
        if( _.isEqual( existingProperty.propertyName, propInfoFromTypeInfoMap.propertyName ) ) {
            isPropExist = true;
            break;
        }
    }
    if( !isPropExist ) {
        propertiesForMapping.push( propInfoFromTypeInfoMap );
    }
};

/**
 * API searches for all required properties and adds Required String in their ui value.
 * @param {Object} data - The view model data
 * @param {Object} newViewModelPropertiesForHeader - VMOs for excel header mappers
 * @returns {Object} - Object with updated values for typePropInfos and propertiesForMapping
 */
let processUIValuesOfAllReqPropsInLOV = function( data, newViewModelPropertiesForHeader ) {
    let typePropInfos = _.clone( data.subPanelContext.sharedData.typePropInfos );
    let propertiesForMapping = _.clone( data.propertiesForMapping );
    for( let mappingOutputIndex = 0; mappingOutputIndex < data.selectedMapping.mappingOutputs.length; mappingOutputIndex++ ) {
        let mappingOutput = data.selectedMapping.mappingOutputs[ mappingOutputIndex ];
        for( let propInfoIndexForMappingOut = 0; propInfoIndexForMappingOut < mappingOutput.propInfos.length; propInfoIndexForMappingOut++ ) {
            let propInfoFromServer = mappingOutput.propInfos[ propInfoIndexForMappingOut ];
            for( let typePropInfoIndex = 0; typePropInfoIndex < typePropInfos.length; typePropInfoIndex++ ) {
                let typePropInfo = typePropInfos[ typePropInfoIndex ];
                let propInfos = typePropInfo.propInfos;
                for( let propInfoIndex = 0; propInfoIndex < propInfos.length; propInfoIndex++ ) {
                    let propInfoFromTypeInfoMap = propInfos[ propInfoIndex ];
                    if( propInfoFromServer.realPropName === propInfoFromTypeInfoMap.propInternalValue ) {
                        propInfoFromTypeInfoMap.dbValue = true;
                        updateDataPropertyMapping( propertiesForMapping, propInfoFromTypeInfoMap );
                        updateValuesInHeaderVMOAsPerValuesComingFromServer( propInfoFromTypeInfoMap, newViewModelPropertiesForHeader, propInfoFromServer );
                        break;
                    }
                }
            }
        }
    }
    return {
        typePropInfos: typePropInfos,
        propertiesForMapping: propertiesForMapping
    };
};

/**
 * Get Mappings for the group selected
 *
 * @param {Object} data - The view model data
 *
 */
export let populateMappingInfoForGroup = function( data ) {
    if( data.mappingGroupResponse.mappingOutputs.length > 0 && data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups.length > 0 ) {
        if( data.mappingGroup.dbValue === data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].dispName ) {
            let newViewModelPropertiesForHeader = destroyExistingVMOAndReCreateVMOForHeaders( data );
            populateValueInLOVFromServerResponse( data.selectedMapping.mappingOutputs[0].propInfos, newViewModelPropertiesForHeader );
            let { typePropInfos, propertiesForMapping } = processUIValuesOfAllReqPropsInLOV( data, newViewModelPropertiesForHeader );
            setModifiabilityOnHeaderVMProp( data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups[ 0 ], newViewModelPropertiesForHeader );
            const newSharedData = { ...data.subPanelContext.sharedData.value };
            newSharedData.typePropInfos = typePropInfos;
            data.subPanelContext.sharedData.update && data.subPanelContext.sharedData.update( newSharedData );
            let allRequiredPropMapped = doesCurrentMappingHaveAllReqProps( data.propertiesForMapping, newViewModelPropertiesForHeader );
            return{
                viewModelPropertiesForHeader: newViewModelPropertiesForHeader,
                propertiesForMapping: propertiesForMapping,
                isAwb0ImportButtonIsVisible: allRequiredPropMapped
            };
        }
    }
};

/**
 * Get input data for Import from Excel
 *
 * @param {Object} data - The view model data
 */
export let getExcelImportInput = function( data ) {
    exports.registerExcelData();
    let runInBackgroundOptionForExcel = [];
    let mappingGroupData = {
        groupName: {
            realName: '',
            dispName: '',
            isModifiable: true
        },
        mappingInfo: [],
        actionName: ''
    };
    let mappingGroupData1 = _.clone( mappingGroupData );
    let mappingInfo = [];

    if( data.mappingGroup.dbValue ) {
        mappingGroupData.groupName.realName = data.mappingGroup.dbValue;
        mappingGroupData.groupName.dispName = data.mappingGroup.dbValue;
    }
    let typeMapInfos = {};
    for( let index = 0; index < data.viewModelPropertiesForHeader.length; index++ ) {
        let viewProp = data.viewModelPropertiesForHeader[ index ];
        if( viewProp.dbValue && !_.isArray( viewProp.dbValue ) ) {
            let dispProp = viewProp.uiValue.replace( data.i18n.required, '' );
            let dbValue = viewProp.dbValue.split( '.' );
            let propertyName = viewProp.dbValue;
            let type = '';
            if( dbValue.length === 2 ) {
                propertyName = dbValue[ 1 ];
                type = dbValue[ 0 ];
            }
            let prop = {
                propHeader: viewProp.propertyName,
                realPropDisplayName: dispProp,
                realPropName: propertyName,
                isRequired: false
            };
            if( dispProp !== viewProp.uiValue ) {
                prop.isRequired = true;
            }
            let propInfos = [];
            if( typeMapInfos && typeMapInfos[ type ] ) {
                propInfos = typeMapInfos[ type ];
            }
            propInfos.push( prop );

            let propForMapping = {
                propHeader: viewProp.propertyName,
                realPropDisplayName: dispProp,
                realPropName: viewProp.dbValue,
                isRequired: false
            };
            mappingInfo.push( propForMapping );
            typeMapInfos[ type ] = propInfos;
        }
    }
    let runInBackgroundOption = 'RunInBackground';

    let actionInfo = {};
    if( _.isEqual( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ), 'Awb0ImportPreview' ) ) {
        actionInfo = importPreviewSetActionOnLine.populateActionInfoMapForImportSOAInput();
    }

    if( !data.runInBackgroundExcel.dbValue ) {
        runInBackgroundOption = '';
    }

    runInBackgroundOptionForExcel.push( runInBackgroundOption );

    if( mappingGroupData.groupName.dispName ) {
        mappingGroupData.mappingInfo = mappingInfo;
        if( mappingGroupData.actionName === '' ) {
            mappingGroupData.actionName = _getActionNameForMapping( data, mappingGroupData );
        }
        if( mappingGroupData.actionName === 'UPDATE' ) {
            let returnObj = {
                headerPropertyMapping: typeMapInfos,
                mappedGroupData: mappingGroupData,
                actionInfo: actionInfo,
                runInBackgroundOptionForExcel: runInBackgroundOptionForExcel
            };
            _showUpdateNotificationWarning( data, returnObj );
        } else if( mappingGroupData.actionName === '' ) {
            mappingGroupData = mappingGroupData1;
        }
    }
    return {
        headerPropertyMapping: typeMapInfos,
        mappedGroupData: mappingGroupData,
        actionInfo: actionInfo,
        runInBackgroundOptionForExcel: runInBackgroundOptionForExcel
    };
};

/**
 * Get ActionName For Mapping
 *
 * @param {Object} data - The view model data
 *
 */
let _getActionNameForMapping = function( data, mappingGroupData ) {
    let headerCount = 0;
    let mappingInfo = {};
    let mappingOutputs = {};
    let actionName = 'ADD';
    if( data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups.length > 0 ) {
        for( let j = 0; j < data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups.length; j++ ) {
            if( data.mappingGroup.dbValue === data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups[ j ].dispName ) {
                actionName = '';
                break;
            }
        }
    }
    if( actionName === '' && data.selectedMapping.mappingOutputs[ 0 ].mappingGroups.length === 1 &&
        data.mappingGroup.dbValue === data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].dispName ) {
        if( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable ) {
            actionName = 'UPDATE';
            for( let j = 0; j < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length; j++ ) {
                for( let k = 0; k < mappingGroupData.mappingInfo.length; k++ ) {
                    mappingInfo = mappingGroupData.mappingInfo[ k ];
                    mappingOutputs = data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ];
                    if( mappingInfo.propHeader === mappingOutputs.propHeader ) {
                        headerCount++;
                        actionName = '';
                        if( mappingInfo.realPropName !== mappingOutputs.realPropName ||
                            mappingInfo.realPropDisplayName !== mappingOutputs.dispPropName ) {
                            actionName = 'UPDATE';
                            break;
                        }
                    }
                }
            }
        } else if( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable === false ) {
            actionName = '';
        }
    }
    if( headerCount !== 0 &&
        ( headerCount < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length || headerCount < mappingGroupData.mappingInfo.length ) ) {
        actionName = 'UPDATE';
    }
    return actionName;
};

/**
 * Show leave warning message
 *
 * @param {Object} data - The view model data
 * @param {Object} returnObj - properties to update on click of cancel/update buttons
 */
let _showUpdateNotificationWarning = function( data, returnObj ) {
    let mappingGroupData = {
        groupName: {
            realName: '',
            dispName: '',
            isModifiable: true
        },
        mappingInfo: [],
        actionName: ''
    };

    let msg = data.i18n.notificationForUpdateMsg.replace( '{0}', returnObj.mappedGroupData.groupName.dispName );
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
            data.dispatch( { path: 'data.headerPropertyMapping', value: returnObj.headerPropertyMapping } );
            data.dispatch( { path: 'data.mappedGroupData', value: mappingGroupData } );
            data.dispatch( { path: 'data.actionInfo', value: returnObj.actionInfo } );
            data.dispatch( { path: 'data.runInBackgroundOptionForExcel', value: returnObj.runInBackgroundOptionForExcel } );
            eventBus.publish( 'importBOM.importFromExcel' );
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.update,
        onClick: function( $noty ) {
            $noty.close();
            data.dispatch( { path: 'data.headerPropertyMapping', value: returnObj.headerPropertyMapping } );
            data.dispatch( { path: 'data.mappedGroupData', value: returnObj.mappedGroupData } );
            data.dispatch( { path: 'data.actionInfo', value: returnObj.actionInfo } );
            data.dispatch( { path: 'data.runInBackgroundOptionForExcel', value: returnObj.runInBackgroundOptionForExcel } );
            eventBus.publish( 'importBOM.importFromExcel' );
        }
    } ];

    notyService.showWarning( msg, buttons );
};

/**
 * Sort the boolean list. True values first
 *
 * @param {Object} list - List to sort
 */
let _sortBooleanList = function( list ) {
    list.sort( function( a, b ) {
        // true values first
        return a.isRequired === b.isRequired ? 0 : a.isRequired ? -1 : 1;
    } );
};
/**
 * Find the given property in properties list
 *
 * @param {List} properties - list of selected properties
 * @param {String} propName - property display name
 * @returns {Boolean} - true, if property exist in the list
 */
let _getPropertyFromList = function( properties, propName ) {
    for( let index = 0; index < properties.length; index++ ) {
        let property = properties[ index ];
        if( property.propertyDisplayValue === propName || property.propDisplayValue === propName.propertyDisplayName ) {
            return property;
        }
    }
    return null;
};

/**
 * This API checks whether all required properties of business object have been mapped to the properties of excel header or not.
 * This API will return true only if all required properties have been mapped. Otherwise it will return false.
 * @param {*} propForMapping
 * NOTE : While doing the mapping, we need to take care of secondary objects as well. We have cases where we properties on secondar object
 * and primary object have same names. In that case to avoid confusion about which property has been filled and which one has not
 * we need use the business object type as well.
 */
let isCurrentRequiredPropHasBeenMappedWithExcelHeader = function( vmProps, propForMapping ) {
    let propertyName = propForMapping.propertyName.split( '.' )[ 1 ];
    let propertyTypeFromMapping = undefined;
    if( propForMapping.isSecondaryObject ) {
        propertyTypeFromMapping = propForMapping.propertyName.split( '.' )[ 0 ];
    }
    let flag = false;
    for( let indexExcelHeaders = 0; indexExcelHeaders < vmProps.length; indexExcelHeaders++ ) {
        let excelHeader = vmProps[ indexExcelHeaders ];
        if( excelHeader.dbValue.length > 0 ) {
            let propNameOfExcelHeader = excelHeader.dbValue.split( '.' )[ 1 ];
            let propTypeOfExcelHeader = excelHeader.dbValue.split( '.' )[ 0 ];
            let isPropMappedCondition = _.isUndefined( propertyTypeFromMapping ) ? _.isEqual( propNameOfExcelHeader, propertyName ) && !excelHeader.isSecondaryObject :
                excelHeader.isSecondaryObject && _.isEqual( propTypeOfExcelHeader, propertyTypeFromMapping ) &&
                _.isEqual( propNameOfExcelHeader, propertyName );
            if( isPropMappedCondition ) {
                flag = true;
            }
        }
    }
    return flag;
};

/**
 * This API Return true when all required properties are mapped to some excel header property and Import opeation can happen
 * otherwise return false which hides Import Strcuture buttong in UI.
 * @returns {Boolean} - true, if all required properties are mapped
 *
 */
let doesCurrentMappingHaveAllReqProps = function( propertiesForMapping, vmProps ) {
    for( let indexForPropsForMapping = 0; indexForPropsForMapping < propertiesForMapping.length; indexForPropsForMapping++ ) {
        let propForMapping = propertiesForMapping[ indexForPropsForMapping ];
        if( propForMapping.isRequired && propForMapping.propertyName ) {
            if( !isCurrentRequiredPropHasBeenMappedWithExcelHeader( vmProps, propForMapping ) ) {
                return false;
            }
        }
    }
    return true;
};

/**
 * Adds property to the array of it is not already available in the passed array.
 * @param {*} arrayOfProps Array of properties
 * @param {*} vmProp : View Model Property
 */
let addPropertyValueToArray = function( arrayOfProps, vmProp ) {
    let hasProperty1 = _getPropertyFromList( arrayOfProps, vmProp );
    // Avoid duplicate property in list
    if( !hasProperty1 ) {
        arrayOfProps.push( {
            propDisplayValue: vmProp.propertyDisplayName,
            propInternalValue: vmProp.propertyName,
            isRequired: vmProp.isRequired
        } );
    }
};

/**
 * Reset ViewModelProperty Value
 *
 * @param {ViewModelProperty} viewProp - view model property
 */
let _resetViewModelPropertyValue = function( viewProp ) {
    viewProp.displayValues = [ '' ];
    viewProp.uiValue = '';
    viewProp.dbValue = '';
    viewProp.dbValues = '';
    viewProp.uiValues = '';
    viewProp.isEnabled = true;
    viewProp.dbOriginalValue = '';
};

/**
 * Reset the filter, when subType gets changed.
 *
 * @param {Object} filterBox - filter textBox component
 * @returns {Object} - cleared filter textBox component
 */
export let resetPropertiesFilter = function( filterBox ) {
    let newFilterBox = _.clone( filterBox );
    _resetViewModelPropertyValue( newFilterBox );
    return newFilterBox;
};

/**
 * Add the selected properties in list for mapping
 *
 * @param {Object} sharedData - shared Atomic data
 *
 */
export let addNewPropertiesForMapping = function(  sharedData = {} ) {
    // Switch the active back to the previous panel
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'Awb0ImportFromExcelSub';
    sharedData.update && sharedData.update( newSharedData );
};

/**
 * Action on the filter
 *
 * @param {Object} data - The view model data
 * @param {Object} typePropInfos - type property information (available properties)
 * @param {Object} subType - Selected subType
 * @returns {Array} - array of properties to select filtered based on subType and filter textBox value
 *
 */
export let actionFilterList = function( data, typePropInfos, subType ) {
    let filter = '';
    if( 'filterBox' in data && 'dbValue' in data.filterBox ) {
        filter = data.filterBox.dbValue;
    }
    return _getFilteredProperties( typePropInfos, filter, subType );
};

/**
 * Get the filtered properties
 *
 * @param {Object} typePropInfos - type property information (available properties)
 * @param {Object} filter - Filter value
 * @param {Object} subType - selected subType
 * @returns {Array} - array of properties to select filtered based on subType and filter textBox value
 *
 */
let _getFilteredProperties = function( typePropInfos, filter, subType ) {
    let propertiesToSelect = [];

    // Get propInfos for the selected subType
    let propInfos = _getPropertiesFromSubType( typePropInfos, subType );

    let filterValue = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );

    // We have a filter, don't add properties unless the filter matches
    if( filterValue !== '' ) {
        for( let i = 0; i < propInfos.length; i++ ) {
            let propInfo = propInfos[ i ];
            let propertyName = propInfo.propertyName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            let propertyDisplayName = propInfo.propertyDisplayName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            if( propertyName.indexOf( filterValue ) !== -1 || propertyDisplayName.indexOf( filterValue ) !== -1 ) {
                propertiesToSelect.push( propInfo );
            }
        }
    } else {
        propertiesToSelect = propInfos;
    }

    return propertiesToSelect;
};

/**
 * Get all properties for the selected subtype
 *
 * @param {Object} typePropInfos - type property information (available properties)
 * @param {Object} subType - selected subType
 * @returns {Array} - array of properties to select filtered based on subType
 *
 */
let _getPropertiesFromSubType = function( typePropInfos, subType ) {
    let propertiesToSelect = [];
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        if( typePropInfo.objectType === subType ) {
            return propertiesToSelect.concat( typePropInfo.propInfos );
        }
    }

    return [];
};

/**
 * Sets the  Import Preview Data. If we are already in importPreview location URI then
 * we clear all updated actions in importPreviewSetActionOnLine list and all loaded VMCs.
 *
 * @param {Object} data - The view model object
 */
export let setImportPreviewData = function( data ) {
    appCtxSvc.registerCtx( 'ImportBOMContext', {
        showPropertiesMap: data.showPropertiesMap,
        fileName: data.fileName,
        fileExt: data.fileExt,
        fileNameNoExt: data.fileNameNoExt,
        files: data.files,
        validFile: data.validFile,
        formData: data.formData,
        fmsTicket: data.fmsTicket,
        response: data.response,
        mappingGroupResponse: data.mappingGroupResponse,
        selectedMapping: data.selectedMapping,
        mappingGroup: data.mappingGroup,
        objectSubTypes: data.objectSubTypes,
        viewModelPropertiesForHeader: data.viewModelPropertiesForHeader,
        columnHeaders: data.columnHeaders,
        secTypePropInfos: data.secTypePropInfos,
        runInBackgroundExcel: data.runInBackgroundExcel,
        propertiesForMapping: data.propertiesForMapping,
        typePropInfos: data.subPanelContext.sharedData.typePropInfos
    } );
    if( _.isEqual( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ), 'Awb0ImportPreview' ) ) {
        appCtxSvc.updatePartialCtx( 'ImportBOMContext.isImportPreviewScreenOpened', true );
        let vmc = appCtxSvc.getCtx( 'aceActiveContext.context.vmc' );
        vmc.clear();
        appCtxSvc.updatePartialCtx( 'aceActiveContext.context.vmc', vmc );
        importPreviewSetActionOnLine.clearUpdateVMOList();
    }
};

/**
 * Read the import preview data from saved CTX
 *  @param {Object} data - The view model data
 */
export let getImportPreviewData = function( sharedData = {}, uploadedFileName ) {
    let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
    if( importBOMContext ) {
        const newSharedData = { ...sharedData.value };
        newSharedData.typePropInfos = importBOMContext.typePropInfos;
        sharedData.update && sharedData.update( newSharedData );
        let newUploadedFileName = _.clone( uploadedFileName );
        newUploadedFileName.dbValue = importBOMContext.fileName;
        newUploadedFileName.uiValue = importBOMContext.fileName;
        return {
            showPropertiesMap: importBOMContext.showPropertiesMap,
            fileName: importBOMContext.fileName,
            fileExt: importBOMContext.fileExt,
            fileNameNoExt: importBOMContext.fileNameNoExt,
            files: importBOMContext.files,
            validFile: importBOMContext.validFile,
            formData: importBOMContext.formData,
            fmsTicket: importBOMContext.fmsTicket,
            response: importBOMContext.response,
            mappingGroupResponse: importBOMContext.mappingGroupResponse,
            selectedMapping: importBOMContext.selectedMapping,
            mappingGroup: importBOMContext.mappingGroup,
            objectSubTypes: importBOMContext.objectSubTypes,
            viewModelPropertiesForHeader: importBOMContext.viewModelPropertiesForHeader,
            columnHeaders: importBOMContext.columnHeaders,
            secTypePropInfos: importBOMContext.secTypePropInfos,
            runInBackgroundExcel: importBOMContext.runInBackgroundExcel,
            propertiesForMapping: importBOMContext.propertiesForMapping,
            uploadedFileName: newUploadedFileName
        };
    }
};

/**
 * Show leave warning message in Preview Screen
 */
export let closeImportPreview = function() {
    let localeTextBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: localeTextBundle.stayTitle,
        onClick: function( $noty ) {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: localeTextBundle.closeTitle,
        onClick: function( $noty ) {
            $noty.close();
            unRegisterExcelData();
            eventBus.publish( 'importBOMPreview.navigateToBack' );
            if( appCtxSvc.getCtx( 'ImportBOMContext' ) ) {
                appCtxSvc.unRegisterCtx( 'ImportBOMContext' );
            }
        }
    }
    ];
    msgSvc.showWarning( localeTextBundle.notificationForImportPreviewClose, buttons );
};

export let getLOVValues = ( propertiesForMapping ) => {
    let lovEntries = [];
    for( let index = 0; index < propertiesForMapping.length; index++ ) {
        let vmProp = propertiesForMapping[ index ];
        addPropertyValueToArray( lovEntries, vmProp );
    }
    lovEntries.push( {
        propDisplayValue: localeTextBundle.addNew,
        propInternalValue: ADD_NEW_INTERNAL
    } );
    return {
        lovData: lovEntries,
        totalFound: lovEntries.length
    };
};

export let loadMappingGroups = ( mappingGroups, filterString ) => {
    let mappingLOVs = [];
    for( let index = 0; index < mappingGroups.length; index++ ) {
        let entry = mappingGroups[ index ];

        let hasProperty = _getPropertyFromList( mappingLOVs, entry );
        // Avoid duplicate property in list
        if( !hasProperty ) {
            mappingLOVs.push( {
                propDisplayValue: entry.realName,
                propInternalValue: entry.dispName
            } );
        }
    }
    if( filterString && filterString.trim() !== '' ) {
        mappingLOVs = mappingLOVs.filter( function( listVal ) {
            return listVal.propInternalValue.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1 ||
                listVal.propDisplayValue.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1;
        } );
    }
    return mappingLOVs;
};

export let switchView = ( dataProvider, viewModelPropertiesForHeader, propertiesForMapping, sharedData = {} ) => {
    let vmProps = _.clone( viewModelPropertiesForHeader );
    for( let i = 0; i < vmProps.length; i++ ) {
        if( vmProps[i].dbValue === ADD_NEW_INTERNAL ) {
            _resetViewModelPropertyValue( vmProps[i] );
            const newSharedData = { ...sharedData.value };
            newSharedData.activeView = 'Awb0AddPropertiesSub';
            sharedData.update && sharedData.update( newSharedData );
            break;
        }
    }
    let allRequiredPropMapped = doesCurrentMappingHaveAllReqProps( propertiesForMapping, vmProps );
    return {
        viewModelPropertiesForHeader: vmProps,
        isAwb0ImportButtonIsVisible: allRequiredPropMapped
    };
};

export const backActionData = ( sharedData ) => {
    let newSharedData = { ...sharedData };
    newSharedData.activeView = 'Awb0ImportFromExcelSub';
    return newSharedData;
};

export let getObjectSubTypes = ( typePropInfos ) => {
    let objectSubTypes = [];
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        let objectType = {
            propDisplayValue: typePropInfo.dispTypeName,
            propInternalValue: typePropInfo.objectType
        };
        objectSubTypes.push( objectType );
    }
    return objectSubTypes;
};

export let validateMappingGroup = ( data ) => {
    if( data.mappingGroup.dbValue !== '' ) {
        let idxOfUserTextInMapping = -1;
        // If user has typed in value then we need to know if it is valid
        idxOfUserTextInMapping = _.findIndex( data.mappingLOVs,
            function( mapping ) { return mapping.propInternalValue === data.mappingGroup.dbValue; }
        );
        if( idxOfUserTextInMapping !== -1 ) {
            eventBus.publish( 'importBOM.populateMappingGroups' );
        }
    } else {
        let newViewModelPropertiesForHeader = destroyExistingVMOAndReCreateVMOForHeaders( data );
        return {
            viewModelPropertiesForHeader: newViewModelPropertiesForHeader,
            isAwb0ImportButtonIsVisible: false
        };
    }
};

export let updateProperties = ( data ) => {
    let typePropInfos = data.subPanelContext.sharedData.typePropInfos;
    for( let j = 0; j < typePropInfos.length; j++ ) {
        let typePropInfo = typePropInfos[ j ];
        if( typePropInfo.objectType === data.subTypes.dbValue ) {
            let propInfos = typePropInfo.propInfos;
            for( let i = 0; i < data.propertiesToSelect.length; i++ ) {
                let vmProp = data.propertiesToSelect[ i ];
                for( let k = 0; k < propInfos.length; k++ ) {
                    if( vmProp.propDisplayValue === propInfos[ k ].propDisplayValue ) {
                        propInfos[ k ] = vmProp;
                    }
                }
            }
            typePropInfos[ j ].propInfos = propInfos;
            break;
        }
    }
    const newSharedData = { ...data.subPanelContext.sharedData.value };
    newSharedData.typePropInfos = typePropInfos;
    data.subPanelContext.sharedData.update && data.subPanelContext.sharedData.update( newSharedData );
};

export let resetView = () => {
    let locationContext = appCtxSvc.getCtx( 'locationContext' );
    if( locationContext['ActiveWorkspace:Location'] === 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' ) {
        eventBus.publish( 'occTreeTable.plTable.reload' );
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
    }
};

export let setInitialValueForSubType = ( subTypes, objectSubTypes ) => {
    if( objectSubTypes && objectSubTypes.length > 0 ) {
        let subTypesCopy = { ...subTypes };
        subTypesCopy.uiValue = objectSubTypes[0].propDisplayValue;
        subTypesCopy.dbValue = objectSubTypes[0].propInternalValue;
        return subTypesCopy;
    }
};

export default exports = {
    registerExcelData,
    updateFormData,
    resetExcelImportData,
    unRegisterExcelData,
    createPropertiesMap,
    getExcelImportInput,
    populateMappingInfoForGroup,
    resetPropertiesFilter,
    addNewPropertiesForMapping,
    actionFilterList,
    setImportPreviewData,
    getImportPreviewData,
    closeImportPreview,
    enableImportStructureButtonInPanel,
    getLOVValues,
    loadMappingGroups,
    switchView,
    backActionData,
    getObjectSubTypes,
    updatePropertiesForMapping,
    validateMappingGroup,
    updateProperties,
    resetView,
    setInitialValueForSubType
};
