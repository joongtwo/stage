// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * This module has service logic to support the Object information Access Page for AM Privileges.
 *
 * @module js/Aut0ObjAccessDetailsService
 */
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import 'js/tcViewModelObjectService'; // Note, this is required for unit tests due to force loading i18n
import _cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';

var exports = {};

/**
 * Selection change handler for the Master table grid. Based on the newly selected (or de-selected) master object,
 * clear the lower details table and async request that data.
 *
 * @param {*} data view model data
 * @param {*} evtData event data
 */
export let gridSelection = function( data, evtData ) {
    var selectedPriv = '';
    if( data ) {
        // only process the grid selection to update the details table if the priviledge indicator is set
        if( data.dataProviders && data.dataProviders.detailsDataProvider &&
            data.dataProviders.detailsDataProvider.viewModelCollection ) {
            data.dataProviders.detailsDataProvider.update( [], 0 ); // clear any existing detail rows.
        }
        // select or deselect - get called for both, but only fire the event on new selection
        if( evtData && evtData.selectedObjects && evtData.selectedObjects.length > 0 ) {
            // single selection support
            var selectedObj = evtData.selectedObjects[ 0 ];
            if( selectedObj && selectedObj.props && selectedObj.props.privilegeName && selectedObj.props.privilegeName.uiValue ) {
                selectedPriv = selectedObj.props.privilegeName.value;
            }
        }
    }
    return selectedPriv;
};

/**
 * little function to lookup the string i18n value from the view model data based on the key.
 *
 * @param {Object} vmData view model data
 * @param {String} key text key
 *
 * @return {String} column display name
 */
var getDataLabel = function( vmData, key ) {
    var result = '';
    var resource = 'SecurityMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    if( vmData && localTextBundle ) {
        if( localTextBundle.hasOwnProperty( key ) ) {
            result = localTextBundle[ key ];
        } else {
            result = key;
        }
    }
    return result;
};

/**
 * provide the list of columns/column configuration data for the Master info table
 *
 * @param {*} vmData view model data
 *
 * @return {Object} column list info
 */
export let loadMasterGridColumns = function( vmData ) {
    return {
        columnInfos: [ {
            name: 'privilegeName',
            displayName: getDataLabel( vmData, 'privilegeName' ),
            width: 175,
            enableColumnHiding: false
        }, {
            name: 'verdict',
            displayName: getDataLabel( vmData, 'verdict' ),
            width: 250,
            enableColumnHiding: false
        } ]
    };
};

/**
 * provide the list of columns/column configuration data for the details info table
 *
 * @param {*} vmData view model data
 *
 * @return {Object} column list info
 */
export let loadDetailsGridColumns = function( vmData ) {
    return {
        columnInfos: [ {
            name: 'namedACL',
            displayName: getDataLabel( vmData, 'namedACL' ),
            width: 235,
            enableColumnHiding: false
        }, {
            name: 'accessor',
            displayName: getDataLabel( vmData, 'accessor' ),
            width: 130,
            enableColumnHiding: false
        }, {
            name: 'rulePath',
            displayName: getDataLabel( vmData, 'rulePath' ),
            width: 638,
            enableColumnHiding: false
        } ]
    };
};

export let loadPrivilegeInfoDetailsGridAsync = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var responseData = {};
    if( data && data.selectedPriv && data.formattedExtraProtectionInfosMap ) {
        responseData.totalFound = 1;
        responseData.searchResults = [ data.formattedExtraProtectionInfosMap[ data.selectedPriv ] ];
    }
    deferred.resolve( responseData );
    return deferred.promise;
};

export let setSelectedObject = function( selected, vmData ) {
    var deferred = AwPromiseService.instance.defer();
    var newvmData = _.cloneDeep( vmData );
    var newselected = _.cloneDeep( selected );
    if( vmData ) {
        // TODO - ensure on selection change that this is the right value - if already saved???

        if( selected && selected.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            newselected = _cdm.getObject( selected.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
        if( selected ) {
            newvmData.selectedObjArray = [ selected ];
        }
        deferred.resolve( newvmData );
    } else {
        deferred.reject( 'no data' );
    }
    return deferred.promise;
};

export let createPrivList = function( response ) {
    var amPrivList;
    amPrivList = response.privNameInfos.map( function( currentValue ) {
        return currentValue.internalName;
    } );
    return amPrivList;
};

export let createPrivDisplayList = function( response ) {
    var amPrivDisplayList;
    amPrivDisplayList = response.privNameInfos.map( function( currentValue ) {
        return currentValue.displayName;
    } );
    return amPrivDisplayList;
};


export let loadPrivilegeListGridAsync = function( vmData ) {
    var deferred = AwPromiseService.instance.defer();

    if( vmData && vmData.totalPrivFound && vmData.privSearchResults && vmData.privSearchResults.length > 0 ) {
        var responseData = {
            totalFound: vmData.totalPrivFound,
            totalLoaded: vmData.totalPrivLoaded,
            searchResults: vmData.privSearchResults
        };
        deferred.resolve( responseData );
    } else {
        deferred.resolve( {} );
    }

    return deferred.promise;
};

export let formatPrivDataForTable = function( privilegeReports, vmData ) {
    var responseData = {};

    var formattedPrivReport = privilegeReports.map( function( currVal, index ) {
        var incInd = index;
        incInd++;
        var verdictString = currVal.verdict ? getDataLabel( vmData, 'grant' ) : getDataLabel( vmData, 'deny' );
        return {
            type: 'Privilege',
            uid: incInd,
            props: {
                privilegeName: {
                    type: 'STRING',
                    hasLov: false,
                    isArray: false,
                    displayValue: currVal.privilegeName,
                    uiValue: vmData.amPrivDisplayList[index],
                    value: currVal.privilegeName,
                    propertyName: 'privilegeName',
                    propertyDisplayName: getDataLabel( vmData, 'privilege' ),
                    isEnabled: true
                },
                verdict: {
                    type: 'STRING',
                    hasLov: false,
                    isArray: false,
                    displayValue: verdictString,
                    uiValue: verdictString,
                    value: verdictString,
                    propertyName: 'verdict',
                    propertyDisplayName: getDataLabel( vmData, 'verdict' ),
                    isEnabled: true
                }
            }
        };
    } );

    responseData.privSearchResults = formattedPrivReport;
    responseData.totalPrivLoaded = formattedPrivReport.length;
    responseData.totalPrivFound = formattedPrivReport.length;

    return responseData;
};

export let formatExtraProtectionInfoForTable = function( extraProtectionInfos, vmData ) {
    return extraProtectionInfos.reduce( function( obj, currentVal, index ) {
        if( currentVal.privilegeNameInfo ) {
            var namedACLString = currentVal.aclNameInfo ? currentVal.aclNameInfo.displayName : '';
            var accessorString = currentVal.accessorTypeNameInfo ? currentVal.accessorTypeNameInfo.internalName : '';
            var rulePathString = '';

            if( currentVal.rules && currentVal.ruleEvaluation && currentVal.rules.length === currentVal.ruleEvaluation.length ) {
                for( var i = currentVal.rules.length - 1; i >= 0; i-- ) {
                    rulePathString = rulePathString + currentVal.rules[ i ] + '(' + currentVal.ruleEvaluation[ i ] + ')' + '/';
                }
                rulePathString = rulePathString.substring( 0, rulePathString.length - 1 );
            }

            var formattedPrivInfoObj = {
                type: 'PrivilegeInfo',
                uid: index,
                props: {
                    namedACL: {
                        type: 'STRING',
                        hasLov: false,
                        isArray: false,
                        displayValue: namedACLString,
                        uiValue: namedACLString,
                        value: namedACLString,
                        propertyName: 'namedACL',
                        propertyDisplayName: getDataLabel( vmData, 'namedACL' ),
                        isEnabled: true
                    },
                    accessor: {
                        type: 'STRING',
                        hasLov: false,
                        isArray: false,
                        displayValue: accessorString,
                        uiValue: accessorString,
                        value: accessorString,
                        propertyName: 'accessor',
                        propertyDisplayName: getDataLabel( vmData, 'accessor' ),
                        isEnabled: true
                    },
                    rulePath: {
                        type: 'STRING',
                        hasLov: false,
                        isArray: false,
                        displayValue: rulePathString,
                        uiValue: rulePathString,
                        value: rulePathString,
                        propertyName: 'rulePath',
                        propertyDisplayName: getDataLabel( vmData, 'rulePath' ),
                        isEnabled: true
                    }
                },
                privilegeName: currentVal.privilegeNameInfo
            };
            obj[ currentVal.privilegeNameInfo.internalName ] = formattedPrivInfoObj;
        }
        return obj;
    }, {} );
};

/**
 * This is the function that responds to a change in the User Context LOVs. Grid rows and context LOVs are cleared based on args supplied
 *
 * @param {*} dataProviders dataProviders that populate the grid
 * @param {*} group fnd0OAREvalCtxGrp
 * @param {*} role fnd0OAREvalCtxRole
 * @param {*} proj fnd0OAREvalCtxProj
 * @param {*} vmData fnd0OAREvalCtxProj
 */
export let evalInputLovChange = function( dataProviders, group, role, proj, vmData ) {
    if( dataProviders && dataProviders.masterListDataProvider && dataProviders.masterListDataProvider.viewModelCollection ) {
        dataProviders.masterListDataProvider.update( [], 0 );
    }
    if( dataProviders && dataProviders.detailsDataProvider && dataProviders.detailsDataProvider.viewModelCollection ) {
        dataProviders.detailsDataProvider.update( [], 0 );
    }
    let lovEntry = {
        propDisplayValue: '',
        propInternalValue: ''
    };
    if( group ) {
        group.setLovVal( { lovEntry }, null );
    }

    if( role ) {
        role.setLovVal( { lovEntry }, null );
    }

    if( proj ) {
        proj.setLovVal( { lovEntry }, null );
    }

    if( vmData ) {
        return formatUserName( vmData );
    }
};

/**
 * Get the current state from the session context (current session info) and use that to initialize the page data
 * values. Those values identify the evaluation context for the access check request.
 *
 * @param {*} selected - the currently selected SOA view model object.
 * @param {*} data - view model data.
 *
 */
export let setInitialContext = function( data ) {
    if( data ) {
        var newvmData = _.clone( data );
        var userDbVal = null;
        var groupDbVal = null;
        var roleDbVal = null;
        var projDbVal = null;

        var userUiVal = null;
        var groupUiVal = null;
        var roleUiVal = null;
        var projUiVal = null;

        if( _cdm ) {
            var userSession = _cdm.getUserSession();
            if( userSession && userSession.props ) {
                if( userSession.props.group ) {
                    groupDbVal = userSession.props.group.dbValues[ 0 ];
                    groupUiVal = userSession.props.group.uiValues[ 0 ];
                }
                if( userSession.props.role ) {
                    roleDbVal = userSession.props.role.dbValues[ 0 ];
                    roleUiVal = userSession.props.role.uiValues[ 0 ];
                }
                if( userSession.props.user ) {
                    userDbVal = userSession.props.user.dbValues[ 0 ];
                    userUiVal = userSession.props.user.uiValues[ 0 ];
                }
                if( userSession.props.project ) {
                    projDbVal = userSession.props.project.dbValues[ 0 ];
                    projUiVal = userSession.props.project.uiValues[ 0 ];
                }
            }

            if( newvmData.modelPropUser.props.fnd0OAREvalCtxtUsr ) {
                newvmData.modelPropUser.props.fnd0OAREvalCtxtUsr.dbValue = userDbVal;
                newvmData.modelPropUser.props.fnd0OAREvalCtxtUsr.uiValue = userUiVal;

                //fields.fnd0OAREvalCtxtUsr.update( newData.fnd0OAREvalCtxtUsr );
            }
            if( newvmData.modelPropUser.props.fnd0OAREvalCtxtGrp ) {
                newvmData.modelPropUser.props.fnd0OAREvalCtxtGrp.dbValue = groupDbVal;
                newvmData.modelPropUser.props.fnd0OAREvalCtxtGrp.uiValue = groupUiVal;
                //fields.modelPropUser.props.fnd0OAREvalCtxtGrp.update( newData.fnd0OAREvalCtxtGrp );
            }
            if( newvmData.modelPropUser.props.fnd0OAREvalCtxtRole ) {
                newvmData.modelPropUser.props.fnd0OAREvalCtxtRole.dbValue = roleDbVal;
                newvmData.modelPropUser.props.fnd0OAREvalCtxtRole.uiValue = roleUiVal;
                //fields.modelPropUser.props.fnd0OAREvalCtxtRole.update( newData.fnd0OAREvalCtxtRole );
            }
            if( newvmData.modelPropUser.props.fnd0OAREvalCtxtProj ) {
                newvmData.modelPropUser.props.fnd0OAREvalCtxtProj.dbValue = projDbVal;
                newvmData.modelPropUser.props.fnd0OAREvalCtxtProj.uiValue = projUiVal;
            }
        }
        var modifiedData = formatUserName( newvmData );
        var userIdString = modifiedData.userIdString;
        var userNameString = modifiedData.userNameString;
    }

    return { newvmData, userIdString, userNameString };
};

var formatUserName = function( vmData ) {
    var newvmData = _.cloneDeep( vmData );
    newvmData.userIdString = newvmData.modelPropUser.props.fnd0OAREvalCtxtUsr.uiValue.substring( newvmData.modelPropUser.props.fnd0OAREvalCtxtUsr.uiValue.indexOf( '(' ) + 1, newvmData.modelPropUser
        .props.fnd0OAREvalCtxtUsr.uiValue.indexOf( ')' ) );
    newvmData.userNameString = newvmData.modelPropUser.props.fnd0OAREvalCtxtUsr.uiValue.split( '(' )[ 0 ].trim();
    return newvmData;
};

/* eslint-disable-next-line valid-jsdoc*/

export default exports = {
    gridSelection,
    loadMasterGridColumns,
    loadDetailsGridColumns,
    loadPrivilegeInfoDetailsGridAsync,
    setSelectedObject,
    setInitialContext,
    createPrivList,
    createPrivDisplayList,
    loadPrivilegeListGridAsync,
    formatPrivDataForTable,
    formatExtraProtectionInfoForTable,
    evalInputLovChange
};
