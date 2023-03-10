// Copyright (c) 2022 Siemens

/**
 * File for common configurator utils.
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0CommonUtils
 */
import appCtxSvc from 'js/appCtxService';
import assert from 'assert';
import awPromiseService from 'js/awPromiseService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import Pca0Constants from 'js/Pca0Constants';
import policySvc from 'soa/kernel/propertyPolicyService';
import _ from 'lodash';

var exports = {};

/**
 *  Process the partial error in SOA response if there are any
 * @param {Object} serviceData from SOA response
 */
export let processPartialErrors = function( serviceData ) {
    var msgObj = {
        name: '',
        msg: '',
        level: 0
    };

    if( serviceData && serviceData.partialErrors ) {
        for( var x = 0; x < serviceData.partialErrors.length; x++ ) {
            for( var y = 0; y < serviceData.partialErrors[ x ].errorValues.length; y++ ) {
                msgObj.msg += serviceData.partialErrors[ x ].errorValues[ y ].message;
                msgObj.msg += '<BR/>';
                msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ x ].errorValues[ y ].level ] );
            }
        }

        if( msgObj.level <= 1 ) {
            messagingService.showInfo( msgObj.msg );
        } else {
            messagingService.showError( msgObj.msg );
        }
    }
};

/**
 * Return cache status for revision rule data in context
 * @param {String} contextKey context key name
 * @returns {Boolean} true if Revision Rule data is cached
 */
export let getRevRuleCacheStatusForContext = function( contextKey ) {
    var context = appCtxSvc.getCtx( contextKey );
    switch ( contextKey ) {
        case Pca0Constants.FSC_CONTEXT:
            if( context.isSearchContext ) {
                return context.isSearchPanelRevRuleDataCached;
            }
            return context.isSettingsPanelRevRuleDataCached;
        default:
            return context.isRevRuleDataCached;
    }
};

/**
 * Get Formatted date with TimeZone
 * @param {Date} dateToFormat - Formal date object to convert
 * @returns {String} return formated date required for TC DB
 */
export let getFormattedDateString = function( dateToFormat ) {
    return dateToFormat.getFullYear().toString() + '-' + ( dateToFormat.getMonth() + 1 ).toString().padStart( 2, '0' ) + '-' + dateToFormat.getDate().toString().padStart( 2,
        '0' ) + 'T00:00:00Z';
};

/**
 * Get date in UTC format
 * @param {Date} dateToFormat - Formal date object to convert
 * @returns {String} return formated date string as DD-MMM-YYYY
 */
export let getFormattedDateFromUTC = function( dateToFormat ) {
    let result = '';
    if( dateToFormat && dateToFormat !== '' ) {
        const dateWithoutTimestamp = dateToFormat.replace( /-/g, '\/' ).replace( /T.+/, '' );
        const utcDate = new Date( dateWithoutTimestamp ).toDateString();
        if( utcDate ) {
            const splitString = utcDate.split( ' ' );
            if( splitString[ 1 ] && splitString[ 2 ] && splitString[ 3 ] ) {
                result = splitString[ 2 ] + '-' + splitString[ 1 ] + '-' + splitString[ 3 ];
            }
        }
    }

    return result;
};

/**
 * Verify input date is UTC
 * @param {String} dateString input Date string
 * @returns {Boolean} true if it's UTC date
 */
export let isUTCFormatString = function( dateString ) {
    if( dateString.match( /T00:00:00[+|-|Z]/ ) ) {
        return true;
    }
    return false;
};

/**
 * Helps to call setProperties SOA which update config perspective with provided revision rule
 * @param {String} contextKey To get context information from global CTX
 * @param {String} revRuleUid To set revision rule on perpesctive
 * @returns {Promise} promise
 */
export let updateRevisionRuleOnPerspective = function( contextKey, revRuleUid ) {
    let deferred = awPromiseService.instance.defer();
    var context = { ..._.get( appCtxSvc, 'ctx.' + contextKey ) };
    var policyId = policySvc.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );

    var propName = 'cfg0RevisionRule';
    dmService.setProperties( [ {
        object: context.configPerspective,
        vecNameVal: [ {
            name: propName,
            values: [ revRuleUid ]
        } ]
    } ] ).then( function( response ) {
        if( policyId ) {
            policySvc.unregister( policyId );
        }

        // Need to update context and applied settings based on SOA response
        // We don't have for now persistent uid from response. Find the perspective
        var updatedPerspective = _.find( response.ServiceData.modelObjects, {
            type: 'Cfg0ConfiguratorPerspective'
        } );
        _.set( context, 'configPerspective', updatedPerspective );
        var appliedRevisionRule = updatedPerspective.props.cfg0RevisionRule;
        /// This is required to fetch variant rules as SOA takes only revision rule name
        const revisionRuleData = response.ServiceData.modelObjects[ appliedRevisionRule.dbValues[ 0 ] ];
        _.set( context, 'configPerspective.revisionRuleDBName', revisionRuleData.props.object_name.dbValues[ 0 ] );
        // Update Revision Rule on context
        _.set( context, 'appliedSettings.configSettings.props.pca0RevisionRule', appliedRevisionRule );
        // Update latest selected revision Rule to prevent SOA call in case same object is getting selected
        _.set( context, 'lastSelectedRevisionRuleUid', revRuleUid );
        appCtxSvc.updateCtx( contextKey, context );

        // Fire events to reload variant expression data and update link
        eventBus.publish( 'Pca0FilterCriteriaSettings.filterCriteriaUpdated' );
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', appliedRevisionRule );

        deferred.resolve();
    },
    function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 *
 * @param {Event map associated with the view model} eventMap
 * @param {Event subject key that got triggered } eventKey
 * @returns EventData mapping to the input event key
 */

export let getEventDataFromEventMap = function( eventMap, eventKey ) {
    let eventData = eventMap[ eventKey ];
    if( eventData && eventData[ eventKey ] ) {
        eventData = eventData[ eventKey ];
    }
    return eventData;
};

/**
 * This function helps to prepare alternateID for VMO
 * @param {String} parentId uid of parent
 * @param {String} childId uid of child
 * @returns {String} alternateID as 'parentID:child' if parent is defined
 */
export let prepareUniqueId = function( parentId, childId ) {
    if( parentId !== childId ) {
        return parentId ? parentId + ':' + childId : childId;
    }
    return parentId;
};

/**
 * Post process SOA response and build revision rules map and list
 * @param {Object} soaResponse Response for getRevRulesForConfiguratorContext SOA
 * @returns {Object} Revision Rules map
 */
export let postProcessGetRevisionRulesFromPlatform = ( soaResponse ) => {
    // Handle partial errors
    if( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
        exports.processPartialErrors( soaResponse.ServiceData );
        return {};
    }

    // Clear
    var revisionRuleUIDs = [];
    let revisionRulesMap = {};

    if( soaResponse && soaResponse.applicableRevisionRules ) {
        revisionRuleUIDs = _.map( soaResponse.applicableRevisionRules, 'uid' );
    }

    // Fetch Model Object for Revision Rules from ServiceData
    for( var idx = 0; idx < revisionRuleUIDs.length; idx++ ) {
        var revRuleUID = revisionRuleUIDs[ idx ];
        var revRuleMO = soaResponse.ServiceData.modelObjects[ revRuleUID ];
        revisionRulesMap[ revRuleUID ] = revRuleMO;
    }
    return revisionRulesMap;
};

/**
 * Util to Programmatically select item in RevisionRule dropdown - given UID
 * @param {UwDataProvider} dataprovider - The data provider
 * @param {Object} revRuleUID - RevisionRule UID to be selected in dropdown
 * @returns {Boolean} true if item is found in dropdown
 */
export let selectRevisionRuleInDropdown = ( dataprovider, revRuleUID ) => {
    var indexOfCurrentRev = dataprovider.viewModelCollection.loadedVMObjects
        .map( function( x ) {
            return x.uid;
        } ).indexOf( revRuleUID );
    if( indexOfCurrentRev >= 0 ) {
        dataprovider.changeObjectsSelection( indexOfCurrentRev,
            indexOfCurrentRev, true );
        return true;
    }
    return false;
};

/**
 * Util to Programmatically select item in RevisionRule dropdown - given String
 * @param {UwDataProvider} dataprovider - The data provider
 * @param {Object} revRuleDbValue - RevisionRule db Value (english)
 * @returns {Boolean} true if item is found in dropdown
 */
export let selectRevisionRuleDbValueInDropdown = ( dataprovider, revRuleDbValue ) => {
    var indexOfCurrentRev = dataprovider.viewModelCollection.loadedVMObjects
        .map( function( x ) {
            return x.props.object_name.dbValues[ 0 ];
        } ).indexOf( revRuleDbValue );
    if( indexOfCurrentRev >= 0 ) {
        dataprovider.changeObjectsSelection( indexOfCurrentRev,
            indexOfCurrentRev, true );
        return true;
    }
    return false;
};

/**
 * Return Selection Objects for getVariantExpressionData3 SOA Input
 * Handle the scenario when consumer apps have set selections
 * @param { string} contextKey - Context Name to get specific data
 * @returns {Object} Selected Objects
 */
export let getSelectedObjectsForSOA = function( contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    var allowConsumerAppsToLoadData = _.get( context, 'allowConsumerAppsToLoadData' );
    if( allowConsumerAppsToLoadData ) {
        var selectedObjectsFromConsumerApps = _.get( context, 'selectedObjectsFromConsumerApps' );
        if( selectedObjectsFromConsumerApps ) {
            return selectedObjectsFromConsumerApps;
        }
    }

    // Send selectedModelObjects as per primary work area if defined.
    // mselected might have been overwritten by manual selection change in dataprovider selectionModel
    if( context && !_.isUndefined( context.selectedModelObjects ) ) {
        // getVariantExpressionData3 SOA only accepts 'type' and 'uid' props for selectedObjects
        // as it internally converts each MO to a tag_t -> we need to omit other properties
        var selectedObjects = [];
        _.forEach( [ ...context.selectedModelObjects ], function( mo ) {
            var filteredMO = _.pick( mo, [ 'type', 'uid' ] );
            selectedObjects.push( filteredMO );
        } );
        return selectedObjects;
    }
    return appCtxSvc.getCtx( 'mselected' );
};

/**
 * Return Perspective information for getVariantExpressionData3 SOA Input
 * @param { String } contextKey - To get data related to context string
 * @returns {Object} Perspective Object
 */
export let getConfigPerspective = function( contextKey ) {
    let context = appCtxSvc.getCtx( contextKey );
    if( context && context.configPerspective ) {
        return {
            uid: context.configPerspective.uid,
            type: 'Cfg0ConfiguratorPerspective'
        };
    }
    return {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };
};

/**
 * Create family ExpansionMap
 * Group nodes are not displayed.
 * Display all families and expand only those having variant conditions defined.
 * @param {Object} soaResponse - the SOA response
 * @returns {Object} Families expansion Map
 */
export let getShowFamiliesExpansionMap = function( soaResponse ) {
    var expansionMap = [];
    var selectionsByFamily = [];
    let variabilityNodes = exports.getVariabilityNodes( soaResponse );

    _.forEach( soaResponse.businessObjectToSelectionMap, function( elemSelections ) {
        _.forEach( elemSelections, function( selection ) {
            var familyNode = _.find( selectionsByFamily, { id: selection.family } );
            var nodeUID = selection.nodeUid;
            if( !nodeUID && selection.props && selection.props.isFreeFormSelection && selection.props.isFreeFormSelection[ 0 ] ) {
                nodeUID = selection.family + ':' + selection.valueText;
            }
            if( !familyNode ) {
                familyNode = {
                    id: selection.family,
                    childNodes: [ { id: nodeUID } ]
                };
                selectionsByFamily.push( familyNode );
            } else {
                familyNode.childNodes.push( { id: nodeUID } );
            }
        } );
    } );
    // Get Root
    let variantTreeData = variabilityNodes;
    let rootElement = variantTreeData.filter( treeNode => treeNode.nodeUid === '' );
    assert( rootElement, 'RootElement is missing in the response' );
    let parentNode = rootElement[ 0 ];

    for( var familyIdx = 0; familyIdx < parentNode.childrenUids.length; familyIdx++ ) {
        var familyUID = parentNode.childrenUids[ familyIdx ];
        var familyNode = {
            id: familyUID
        };

        // Look for current selections for the family.
        // in case selections are present, add all child Nodes to the tree (i.e., family node will be expanded)
        var selectionsFound = false;
        _.forEach( soaResponse.businessObjectToSelectionMap, function( elemSelections ) {
            _.forEach( elemSelections, function( selection ) {
                if( selection.family === familyUID && _.find( selectionsByFamily, { id: selection.family } ) ) {
                    // Family has selections
                    selectionsFound = true;
                    return false; // this works as break in lodash.
                }
            } );

            if( selectionsFound ) {
                return false; // this works as break in lodash.
            }
        } );

        if( selectionsFound ) {
            familyNode.childNodes = [];
            var family_variabilityData = _.find( variabilityNodes, {
                nodeUid: familyUID
            } );
            _.forEach( family_variabilityData.childrenUids, id => {
                familyNode.childNodes.push( { id: id } );
            } );
        }
        expansionMap.push( familyNode );
    }
    return expansionMap;
};

//
/**
 * Helps to set uiValue of collapsed/expanded node, which will be used as summary of family
 * @param {Object} selectionMap - businessObjectToSelectionMap
 * @param {ViewModelTreeNode} viewModelTreeNode treeNode which is collapsed/expanded to set uiValue which will be display as summary
 *  @param {Object} viewModelObjectMap - From soaResponse we use it to read display name of feature
 */
export let updateViewModelTreeNodeSummary = ( selectionMap, viewModelTreeNode, viewModelObjectMap ) => {
    // mapKey is column as rule uid and mapSelections are familySelectionMap for that column
    Object.entries( selectionMap ).forEach( ( [ mapKey, mapSelections ] ) => {
        //
        // TODO need to initialize with Cell selection value, before appending children values
        //
        let displayName = '';
        const localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
        if( !viewModelTreeNode.isExpanded ) {
            // values for isExpanded:
            // - undefined comes from cfx when manually collpasing node
            // - false value when tree is being loaded recursively
            for( const key in mapSelections ) {
                if( key.indexOf( viewModelTreeNode.uid ) === -1 ) {
                    continue;
                }
                const selectionNode = mapSelections[ key ];
                if( displayName.length >= 1 ) {
                    displayName += ', ';
                }
                // childrenUid might be undefined for special nodes at summaryLevel
                // (i.e. 'Properties Information" child nodes)
                // selectionState is not 0 AND NODE is family selection OR NODE has children
                if( selectionNode.selectionState !== 0 && viewModelTreeNode.uid === selectionNode.nodeUid ||
                    !_.isUndefined( viewModelTreeNode.childrenUids ) && viewModelTreeNode.childrenUids.includes( selectionNode.nodeUid ) ) { // family selection
                    if( selectionNode.selectionState === 1 && viewModelTreeNode.uid === selectionNode.nodeUid ) {
                        displayName = _.isUndefined( localeTextBundle.anyTitle ) ? 'Any' : localeTextBundle.anyTitle;
                    } else if( selectionNode.selectionState === 2 && viewModelTreeNode.uid === selectionNode.nodeUid ) {
                        displayName = _.isUndefined( localeTextBundle.noneTitle ) ? 'None' : localeTextBundle.noneTitle;
                    } else if( selectionNode.selectionState === 1 ) {
                        displayName += viewModelObjectMap[ selectionNode.nodeUid ].displayName;
                    } else if( selectionNode.selectionState === 2 ) {
                        displayName += '!' + viewModelObjectMap[ selectionNode.nodeUid ].displayName;
                    }
                } else if( selectionNode.selectionState !== 0 && viewModelTreeNode.isEnumerated || viewModelTreeNode.isFreeForm ) {
                    displayName += selectionNode.valueText; // valueText is valid only in case of enumerated and freeForm
                }
            }
        }
        // Modify propertyMap for the given propKey
        if( viewModelTreeNode.props[ mapKey ] ) {
            viewModelTreeNode.props[ mapKey ].uiValue = displayName;
            viewModelTreeNode.props[ mapKey ].isSummarized = false; //  This is required in case of resetting Summary to empty on expansion.

            if( displayName !== '' ) {
                viewModelTreeNode.props[ mapKey ].isSummarized = true;
            }
        }
    } );
};

/**
 * Purpose of this function is to return businessObjectMap as per constraint grid and ( VCA or VCV )
 * In future we need to keep only grid data
 * // will remove dependency of soaResponse
 * @param {Object} gridData - To serve for constraints grid
 * @param {Object} soaResponse - To serve for VCA and VCV
 * @returns {object} Selection object map
 */
export let getExpressionMap = ( gridData, soaResponse ) => {
    if( gridData ) {
        return gridData.businessObjectToSelectionMap;
    }
    return soaResponse.businessObjectToSelectionMap;
};

/**
 * Helps to get variabilityNodes from soaResponce
 * @param {Object} soaResponse server response
 * @returns {Object} variabilityNodes
 */
export let getVariabilityNodes = ( soaResponse ) => {
    // TODO:Jinesh GetVariantExpressionData3, VCV3 uses variabilityTreeData. However, getVariability2 still
    //  uses variabilityNodes. Hence, the tertiary conditional operator is used below
    return soaResponse.variabilityTreeData.variabiltyNodes ? soaResponse.variabilityTreeData.variabiltyNodes : soaResponse.variabilityTreeData;
};

/**
 * Close Command Panel if not pinned
 * @param {Object} subPanelContext  command panel context
 */
export let closeToolsAndInfoPanel = ( subPanelContext ) => {
    if( subPanelContext && !subPanelContext.panelPinned ) {
        var eventData = {
            source: 'toolAndInfoPanel'
        };
        eventBus.publish( 'complete', eventData );
    }
};

/**
 * Get list of 'Properties Information' nodes as per SOA response
 * @param {Array} variabilityTreeData Variability Nodes
 * @returns
 */
export let getPropertiesInformationUIDs = ( variabilityTreeData ) => {
    let propUIDs = [];
    let propInfoNode = _.find( variabilityTreeData, { nodeUid: veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID } );
    if( !_.isUndefined( propInfoNode ) && !_.isUndefined( propInfoNode.childrenUids ) ) {
        propUIDs = [ ...propInfoNode.childrenUids ];
    }
    return propUIDs;
};

/**
 * Updates dirty flag on VMOs for which selection update is successful.
 * @param {object} treeDataProvider - To get all VMOs.
 * @param {object} businessObjectToSelectionMap - All selected objects on which update was done.
 * @param {object} eventData -  To get selected objects out of all on which update was succesful.
 */
export let updateDirtyElements = function( treeDataProvider, businessObjectToSelectionMap, eventData ) {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let savedObjects =  !_.isUndefined( eventData.savedColumns ) ? eventData.savedColumns : Object.keys( businessObjectToSelectionMap );

    for( var vmoIndex = 0; vmoIndex < vmos.length; vmoIndex++ ) {
        for( var objIndex = 0; objIndex < savedObjects.length; objIndex++ ) {
            if( vmos[vmoIndex].props[ savedObjects[objIndex] ].dirty ) {
                vmos[vmoIndex].props[ savedObjects[objIndex] ].dirty = false;
                vmos[vmoIndex].props[ savedObjects[objIndex] ].valueUpdated = false;
                vmos[vmoIndex].props[ savedObjects[objIndex] ].displayValueUpdated = false;
                vmos[vmoIndex].props[ savedObjects[objIndex] ].originalValue =  vmos[vmoIndex].props[ savedObjects[objIndex] ].dbValue[ 0 ];
            }
        }
    }
    treeDataProvider.update( vmos );
};

/**
 * Returns saved columns for further processing.
 * @param {object} businessObjectToSelectionMap - All selected objects for update.
 * @param {object} serviceData - service Data
 * @returns {object} list of all successfully saved objects.
 */
export let updateSavedAndUnsavedCols = function( businessObjectToSelectionMap, serviceData ) {
    let allSelectedObjects = Object.keys( businessObjectToSelectionMap );
    let unsavedObjects = [];
    let successfullySavedObjects = [];
    if( serviceData && serviceData.partialErrors ) {
        unsavedObjects = serviceData.partialErrors.map( error => error.uid );
    }
    successfullySavedObjects = allSelectedObjects.filter( x => !unsavedObjects.includes( x ) );
    return successfullySavedObjects;
};


export default exports = {
    processPartialErrors,
    getRevRuleCacheStatusForContext,
    getFormattedDateString,
    getEventDataFromEventMap,
    getFormattedDateFromUTC,
    isUTCFormatString,
    updateRevisionRuleOnPerspective,
    prepareUniqueId,
    postProcessGetRevisionRulesFromPlatform,
    selectRevisionRuleInDropdown,
    selectRevisionRuleDbValueInDropdown,
    getSelectedObjectsForSOA,
    getConfigPerspective,
    getShowFamiliesExpansionMap,
    updateViewModelTreeNodeSummary,
    getExpressionMap,
    getVariabilityNodes,
    closeToolsAndInfoPanel,
    getPropertiesInformationUIDs,
    updateDirtyElements,
    updateSavedAndUnsavedCols
};
