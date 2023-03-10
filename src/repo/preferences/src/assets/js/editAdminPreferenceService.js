// @<COPYRIGHT>@
// ===========================================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ===========================================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * A service that manages the Info and Edit use case of preference.<br>
 *
 * @module js/editAdminPreferenceService
 */

import prefService from 'js/adminPreferencesService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import soaService from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import cmdPanelService from 'js/commandPanel.service';
import editHandlerService from 'js/editHandlerService';
import prefsEHFactory from 'js/adminPreferencesEHFactory';
import dataSourceService from 'js/dataSourceService';
import AwPromiseService from 'js/awPromiseService';
import localeService from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import assert from 'assert';

var exports = {};


/**
   * Get all attributes of selected preference to show inside Info panel and set edit credential in vmData.
   * @param {Object} selectedRow selected item in row
   * @param {Object} prefCtx the context for the preferences page
   *
   * @return {Object} preference object from adminPreferencesService:_preferenceInstances
   */
export let preferenceInfoReveal = function( selectedRow, prefCtx ) {
    var prefInstance = {};
    prefInstance.fnd0PreferenceName = selectedRow.props.prf1Name.dbValue;
    prefInstance.fnd0ProductArea = selectedRow.props.prf1ProductArea.dbValue;
    prefInstance.fnd0ProtectionScope = selectedRow.props.prf1Scope.dbValue;
    prefInstance.fnd0Environment = selectedRow.props.prf1Environment.dbValue;
    prefInstance.fnd0Description = selectedRow.props.prf1Description.dbValue;
    prefInstance.fnd0ValueType = selectedRow.props.prf1Type.dbValue;
    prefInstance.fnd0IsMultiValue = selectedRow.props.prf1Array.dbValue;

    prefInstance.fnd0PreferenceValues = selectedRow.props.prf1ValuesList.dbValue;
    if( prefInstance.fnd0IsMultiValue === false ) {
        prefInstance.fnd0PreferenceValues = prefInstance.fnd0PreferenceValues[0];
    }

    prefInstance.fnd0Location = selectedRow.props.prf1Location.dbValue;

    var systemAdmin = adminPreferenceUserUtil.isSystemAdmin();
    var groupAdmin = adminPreferenceUserUtil.isGroupAdmin();

    //Determine if the user can edit the preference
    if( systemAdmin ) {
        prefCtx.canUserEdit = true;
    } else if( groupAdmin && ( prefInstance.fnd0Location.startsWith( 'Group' ) || prefInstance.fnd0Location.startsWith( 'Role' ) ) ) {
        prefCtx.canUserEdit = true;
    } else if( prefInstance.fnd0Location.startsWith( 'User' ) ) {
        prefCtx.canUserEdit = true;
    } else {
        prefCtx.canUserEdit = false;
    }

    // Determine if the user can edit the definition
    if( systemAdmin &&  prefInstance.fnd0Location === 'Site' ||  prefInstance.fnd0Location === 'None' ) {
        prefCtx.canUserEditDefinition = true;
    } else {
        prefCtx.canUserEditDefinition = false;
    }
    return {
        response: prefInstance
    };
};

/**
   * Selection change handler for the Info Panel. When info panel is open and user clicks on
   * another preference in table, it will trigger event and update the content inside Info panel.
   * @param {Object} evtData event data for selection change
   * @param {Object} prefCtx context for the preferences page
   *
   * @return {Object} preference object from adminPreferencesService:_preferenceInstances
   */
export let preferenceInfoSelectionChange = function( evtData, prefCtx ) {
    var activeCommand = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
    if( activeCommand ) {
        cmdPanelService.activateCommandPanel( activeCommand.commandId, 'aw_toolsAndInfo' );
    }

    var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
    if( prefEditHandler !== null ) {
        prefEditHandler.setResetPWA( true );
        editHandlerService.setActiveEditHandlerContext( 'PREF_EDIT_CONTEXT' );
    }
    var selectedPreference;
    if( evtData ) {
        selectedPreference = exports.preferenceInfoReveal( evtData, prefCtx );
    }
    return editHandlerService.leaveConfirmation().then( function() {
        var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
        let newctxEdit = { ...ctxeditInProgress };
        if( ctxeditInProgress.editInProgress ) {
            newctxEdit.editInProgress = false;
        }
        appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );
        return selectedPreference;
    } );
};

/**
   * Adding edit handler to edit the selected preferences
   *
   * @param {Object} vmData - viewModel for selected row
   * @param {Object} selectedPreference - selected preference in table
   * @param {Object} prefCtx - the context for the preferences page
   *
   */
export let addEditHandler = function( vmData, selectedPreference, prefCtx ) {
    vmData.vmo = vmData.preferenceInfo;
    vmData.data.objects = vmData.vmo;
    vmData.data.objects.props.uid = 'AAAAAAAAAA';
    var clonedPreference = _.cloneDeep( selectedPreference );
    var clonedPrefCtx = _.cloneDeep( prefCtx );
    var dataSource = dataSourceService.createNewDataSource( {
        declViewModel: vmData
    } );

    var startEditFunc = function() {
        var deferred = AwPromiseService.instance.defer();
        deferred.resolve( {} );
        return deferred.promise;
    };

    var saveEditFunc = function() {
        return exports.updatePreference( vmData, clonedPreference, clonedPrefCtx );
    };

    //create Edit Handler
    var editHandler = prefsEHFactory.createEditHandler( dataSource, startEditFunc, saveEditFunc );

    if( editHandler ) {
        editHandlerService.setEditHandler( editHandler, 'PREF_EDIT_CONTEXT' );
        editHandlerService.setActiveEditHandlerContext( 'PREF_EDIT_CONTEXT' );
        editHandler.startEdit();
    }
};

/**
   * Get display value for 'Array' label on Info panel.
   * This is stored as boolean, but it is being shown as 'Yes' or 'No'
   * @param {boolean} value true or false
   *
   * @return {String} display value for multiple value field
   */
export let getDisplayValueForBoolean = function( value ) {
    var localTextBundle = localeService.getLoadedText( 'preferenceInfoMessages' );
    return value === true ? localTextBundle.yes : localTextBundle.no;
};

/**
   * Get display value for 'Environment' label on Info panel.
   * This is stored as boolean, but it is being shown as 'Enabled' or 'Disabled'
   * @param {boolean} value true or false
   *
   * @return {String} display value for environment enabled field
   */
export let getDisplayValueForEnvEnabled = function( value ) {
    var localTextBundle = localeService.getLoadedText( 'preferenceInfoMessages' );
    return value === true ? localTextBundle.enabledEnv : localTextBundle.disabledEnv;
};

/**
   * Get display value for 'value type' label on Info panel.
   * @param {boolean} value value type string
   *
   * @return {String} display value for value type
   */
export let getDisplayValueForType = function( value ) {
    return localeService.getLoadedText( 'preferenceInfoMessages' )[ value ];
};

/**
   * Get display value for 'ProtectionScope' label.
   * @param {boolean} value key of Protection Scope messages
   *
   * @return {String} display value for Protection Scope field
   */
export let getDisplayValueForProtectionScope = function( value ) {
    return localeService.getLoadedText( 'preferenceMessages' )[ value ];
};

/**
   * Get is Protection Scope Enable.
   * This is stored as boolean, but it is being shown as 'Enabled' or 'Disabled'
   * @param {boolean} canEditDefinition true or false
   * @param {boolean} isEditable true or false
   * @param {String} protectionScope protection scope
   *
   * @return {boolean} display value for environment enabled field
   */
export let isProtectionScopeEditable = function( canEditDefinition, isEditable, protectionScope ) {
    return canEditDefinition && isEditable && protectionScope !== 'System';
};

/**
   * Get data type for ViewModelProperty.
   * Preference value can be non-array or array of string data type.
   * Correct type, STRING or STRINGARRAY, should be passed to dataParseDefinitions, so that
   * dataMapperService.js from afx framework can convert it to proper ViewModelProperty object.
   *
   * NOTE: Due to bug in datamapper for Date type, we are using text field for DATE type
   * @param {boolean} isArray array or non-array
   * @param {String} valueType date or other type
   *
   * @return {String} type string for dataParseDefinitions
   */
export let getVMPropertyType = function( isArray, valueType ) {
    if( valueType === 'Integer' ) {
        return isArray === true ? 'INTEGERARRAY' : 'INTEGER';
    } else if( valueType === 'Double' ) {
        return isArray === true ? 'DOUBLEARRAY' : 'DOUBLE';
    }
    return isArray === true ? 'STRINGARRAY' : 'STRING';
};

export let isPropertyEditable = function( canEditDefinition, editInProgress ) {
    return canEditDefinition && editInProgress;
};

/**
   * Get clone of values.
   *
   * @param {Object} values date or other type
   *
   * @return {Object} copy\clone of values
   */
export let getClonedValue = function( values ) {
    return _.cloneDeep( values );
};

/**
   * This method sets editInProgress to true and triggers the reveal of preference info in edit mode
   * @param {Object} prefCtx - admin console context
   * @param {vmData} vmData - view model data
   */
export let startEditPreference = function( prefCtx, vmData ) {
    //prefCtx.editInProgress = true;
    var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
    let newctxEdit = { ...ctxeditInProgress };
    newctxEdit.editInProgress = true;
    appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );
    // build the product area list
    var productAreaList = prefService.getProductAreaList();
    eventBus.publish( 'Preferences.revealPreferenceInfo' );

    return productAreaList;
};

/**
   * This method triggers the updatePreference event
   */
export let savePreferenceEdits = function() {
    eventBus.publish( 'Preferences.updatePreference' );
};

/**
   * This method sets editInProgress to false and triggers the reveal of preference info in non-edit mode
   * @param {Object} prefCtx - admin console context
   */
export let cancelPreferenceEdits = function( prefCtx ) {
    var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
    if( prefEditHandler !== null ) {
        editHandlerService.cancelEdits();
    }
    var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
    let newctxEdit = { ...ctxeditInProgress };
    newctxEdit.editInProgress = false;
    appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );
    eventBus.publish( 'Preferences.revealPreferenceInfo' );
};

/**
   * Populate the fields on edit panel.
   *
   * @param  {Object} vmData - viewModel Data
   * @param  {Object} sourcePref - source preference instance
   */
export let populateEditPreferencePanel = function( vmData ) {
    // build the product area list
    var productAreaList = prefService.getProductAreaList();

    // build protection scope list
    var protectionScopeList = prefService.getProtectionScopes( vmData.localizedProtectionScopes );

    return { productAreaList, protectionScopeList };
};

/**
   * Update the definition or location value of selected preference based on selection and user's privilege.
   *
   * @param  {Object} vmData - viewModel Data
   * @param  {Object} selectedPreference - selected preference
   * @param  {Object} prefCtx - admin console context
   *
   * @returns {Promise} - success or failure
   */
export let updatePreference = function( vmData, selectedPreference, prefCtx ) {
    //
    // Following fields can be updated
    // Definition:
    // 1. Description,
    // 2. Product Area,
    // 3. Protection Scope,
    // 4. Environment,
    // 5. Site Value
    //
    // Instance:
    // 1. Value at location
    //
    var description = vmData.preferenceInfo.props.fnd0Description.dbValue;
    var newProductArea = vmData.preferenceInfo.props.fnd0ProductArea.dbValue;
    var protectionScope = vmData.preferenceInfo.props.fnd0ProtectionScope.dbValue;
    var environment = vmData.preferenceInfo.props.fnd0EditEnvironment.dbValue;
    var prefValues = vmData.preferenceInfo.props.fnd0PreferenceValues.displayValues;
    var selectedPrefName = selectedPreference.props.prf1Name.dbValue;
    var selectedLocation = selectedPreference.props.prf1Location.dbValue;
    var selectedProductArea = selectedPreference.props.prf1ProductArea.dbValue;

    assert( vmData.preferenceInfo.props.fnd0PreferenceName.dbValue === selectedPrefName, 'Name of preference can not be changed.' );
    assert( vmData.preferenceInfo.props.fnd0Location.uiValue === selectedLocation, 'Location of preference instance can not be changed.' );

    // Find the preference instance given preference name and product area
    //var prefInstanceToUpdate = prefService.getSelectedPreferenceInstance( selectedProductArea, selectedPrefName, selectedLocation );

    var isEditingDefinition = adminPreferenceUserUtil.convertToBoolean( prefCtx.canUserEditDefinition );

    // This block would get executed for updating definition
    if( isEditingDefinition ) {
        var setPreferencesDefinitionInput = {
            preferenceInput: [ {
                definition: {
                    name: selectedPrefName,
                    category: newProductArea,
                    description: description,
                    isEnvEnabled: environment,
                    protectionScope: protectionScope,
                    type: prefService.convertValueTypeToInt( selectedPreference.props.prf1Type.dbValue ),
                    isArray: selectedPreference.props.prf1Array.dbValue,
                    isOOTBPreference: false,
                    isDisabled: false
                },
                values: prefValues
            } ]
        };
        // 1. Update the definition
        return soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'setPreferencesDefinition', //
            setPreferencesDefinitionInput )
            .then( function( response ) {
                // 2. handle the error
                var err = adminPreferenceUserUtil.handleSOAResponseError( response );

                if( !_.isUndefined( err ) ) {
                    return adminPreferenceUserUtil.getRejectionPromise( err );
                }

                if( newProductArea !== selectedProductArea ) {
                    selectedPreference.props.prf1ProductArea.dbValue = newProductArea;
                    selectedPreference.props.prf1ProductArea.uiValue = newProductArea;
                }
                // 3. reset the variables in adminPreferencesService
                var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
                let newctxEdit = { ...ctxeditInProgress };
                newctxEdit.editInProgress = false;
                appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );

                var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
                if( prefEditHandler !== null ) {
                    editHandlerService.cancelEdits();
                }
            }, function( err ) {
                throw err;
            } );
    }
    // Value of instance is going to be updated
    // 1. Save the changes to database
    var setPreferencesInput = {
        setPreferenceIn: [ {
            location: exports.getLocation( selectedLocation ),
            preferenceInputs: {
                preferenceName: selectedPrefName,
                values: prefValues
            }
        } ]
    };

    return soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'setPreferencesAtLocations', //
        setPreferencesInput )
        .then( function( response ) {
            // 2. handle the error
            var err = adminPreferenceUserUtil.handleSOAResponseError( response );
            if( !_.isUndefined( err ) ) {
                return adminPreferenceUserUtil.getRejectionPromise( err );
            }
            // 3. reset the variables in adminPreferencesService
            var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
            let newctxEdit = { ...ctxeditInProgress };
            newctxEdit.editInProgress = false;
            appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );

            var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
            if( prefEditHandler !== null ) {
                editHandlerService.cancelEdits();
            }
        }, function( err ) {
            throw err;
        } );
};

export let getLocation = function( selectedLocation ) {
    var groupUID = appCtxSvc.getCtx( 'groupUID' );
    var userUID = appCtxSvc.getCtx( 'userUID' );
    var roleUID = appCtxSvc.getCtx( 'roleUID' );

    if( selectedLocation === 'None' ) {
        var siteLoc = 'Site';
        return { siteLoc };
    }

    if( _.isUndefined( groupUID ) && _.isUndefined( userUID ) && _.isUndefined( roleUID ) ) {
        return { selectedLocation };
    }

    if( selectedLocation.startsWith( 'Group' ) ) {
        var OrgObject = {
            type : 'Group',
            uid : groupUID
        };
    } else if( selectedLocation.startsWith( 'Role' ) ) {
        var OrgObject = {
            type : 'Role',
            uid : roleUID
        };
    } else if( selectedLocation.startsWith( 'User' ) ) {
        var OrgObject = {
            type : 'User',
            uid : userUID
        };
    }

    return { object:OrgObject };
};

export default exports = {
    preferenceInfoReveal,
    preferenceInfoSelectionChange,
    addEditHandler,
    getDisplayValueForBoolean,
    getDisplayValueForEnvEnabled,
    getDisplayValueForType,
    getDisplayValueForProtectionScope,
    isProtectionScopeEditable,
    getVMPropertyType,
    isPropertyEditable,
    getClonedValue,
    startEditPreference,
    savePreferenceEdits,
    cancelPreferenceEdits,
    populateEditPreferencePanel,
    updatePreference,
    getLocation
};


