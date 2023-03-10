// Copyright (c) 2022 Siemens

/**
 * This is a utility to get the class properties, property groups and properties for selected node which is application class
 *
 * @module js/classifyAdminNodesAppClassService
 */
import _ from 'lodash';

import classifySvc from 'js/classifyService';
import soaService from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import classifyFilterUtils from 'js/classifyFilterUtils';
import classifyViewSvc from 'js/classifyViewService';

var serviceName = 'Internal-IcsAw-2019-12-Classification';
var operationName = 'findClassificationInfo3';
var exports = {};

/**
 * Following method detects the node
 * @param {Object} selectedNode THe selected object
 * @param {Object} data Declarative view model
 * @param {Object} searchState sub panel context's searchState
 */
export let detectNode = function( selectedNode, data, searchState ) {
    var tmpState = { ...searchState.value };
    tmpState.appClassData = {};
    tmpState.appClassData.attr_anno = null;
    tmpState.appClassData.attributesVisible = false;
    // Update searchState's selectedClass.uid to reload property groups section
    tmpState.selectedClass = selectedNode;
    tmpState.selectedClass.uid = selectedNode.id;

    tmpState.isAdmin = true;
    tmpState.panelMode = -1;

    data.selectedClass = selectedNode;
    if( selectedNode && selectedNode.type === 'StorageClass' ) {
        exports.getAttributes( data, tmpState, searchState );
    } else {
        searchState.update( tmpState );
    }
};

/**
 * gets the attribute data for selected Application class & calls the attribute formatting method.
 * @param {*} data Declarative view model
 * @param {Object} tmpState temporary searchState from calling function
 * @param {Object} searchState sub panel context's searchState
 */
export let getAttributes = function( data, tmpState, searchState ) {
    var searchCriteria = {};
    searchCriteria.searchAttribute = classifySvc.UNCT_CLASS_ID;
    searchCriteria.searchString = data.selectedClass.id;
    searchCriteria.sortOption = classifySvc.UNCT_SORT_OPTION_CLASS_ID;
    var request = {
        workspaceObjects: [],
        searchCriterias: [ searchCriteria ],
        classificationDataOptions: classifySvc.loadStorageAttributes
    };

    soaService.post( serviceName, operationName, request ).then(
        function( response ) {
            exports.formatDataAndResponse( response, data, tmpState, searchState );
        } );
};

/**
 *  Following method processes the findClassificationInfo2 SOA response and make initializations on view model
 * @param {*} response findClassificationInfo2 SOA response
 * @param {*} data Declarative view model
 * @param {Object} tmpState temporary searchState from calling function
 * @param {Object} searchState sub panel context's searchState
 */
export let formatDataAndResponse = function( response, data, tmpState, searchState ) {
    data.classDefinitionMapResponse = response.clsClassDescriptors;
    data.keyLOVDefinitionMapResponse = response.keyLOVDescriptors;
    data.blockDefinitionMapResponse = response.clsBlockDescriptors;
    data.unitMap = response.unitMap;

    if( data.classDefinitionMapResponse && tmpState.appClassData !== undefined ) {
        var attributesDefinitions = null;
        //Format the attributes for display
        attributesDefinitions = data.classDefinitionMapResponse[ data.selectedClass.id ].attributes;
        tmpState.appClassData.classesProperties = data.classDefinitionMapResponse[ data.selectedClass.id ].properties;

        tmpState.appClassData.isCSTNode = true;
        tmpState.appClassData.isGroupNode = false;

        //Handling for ID
        _.forEach( classifySvc.UNCT_CLASS_ATTRIBUTES, function( key, index ) {
            var value = classifySvc.getPropertyValue(
                tmpState.appClassData.classesProperties, key );
            if( key === 'CLASS_OBJECT_TYPE' ) {
                if( value === 'MASTER_NODE' ) {
                    tmpState.appClassData.isCSTNode = false;
                }
                if( value === 'GROUP_NODE' ) {
                    tmpState.appClassData.isGroupNode = true;
                }
            }
            key = classifySvc.UNCT_CLASS_ATTRIBUTES_DISP[ index ];
            var vmoProp = uwPropertyService.createViewModelProperty( key, key, '', value.toString(), value.toString() );
            vmoProp.uiValue = value.toString();
            tmpState.appClassData.classesProperties.push( vmoProp );
        } );

        data.attr_anno = [];
        var valuesMap = null;
        if( attributesDefinitions ) {
            classifySvc.formatAttributeArrayForAdmin( data, attributesDefinitions, valuesMap, data.attr_anno, '', false, false, null, 0 );
        }
        //handle any filter from preview
        classifyFilterUtils.filterProperties( data, true );
        classifyViewSvc.populatePropertyGroupTree( data.attr_anno );
        data.hasBlocks = false;

        for( var i = 0; i < data.attr_anno.length; i++ ) {
            if( data.attr_anno[ i ].type === 'Block' ) {
                data.hasBlocks = true;
            } else if( data.attr_anno[ i ].vmps[2].propertyDisplayName ) {
                // assigned unit info (vmps[2]) to value object so as to pass it to AwClsList component
                data.attr_anno[ i ].vmps[2].value = data.attr_anno[ i ].vmps[2];
            }
        }

        tmpState.appClassData.attrs = data.attr_anno;
        tmpState.attrs = data.attr_anno;
        tmpState.plainAttrs = data.attr_anno;
        tmpState.appClassData.classifyHasPropGroups = data.hasBlocks;
        searchState.update( tmpState );
    }
};

/**
 * following method returns application class information from subpanelcontext's searchState
 * @param {Object} searchState subPanelContext's searchState
 * @return {Object} Application class information
 */
export let setAppClassData = function( searchState ) {
    return {
        isCSTNode: searchState.appClassData.isCSTNode,
        isGroupNode: searchState.appClassData.isGroupNode,
        hasBlocks: searchState.appClassData.classifyHasPropGroups,
        attr_anno: searchState.attrs,
        attributesVisible: searchState.appClassData.attributesVisible,
        propAttr: searchState.appClassData.propAttr
    };
};

/**
 * following method clears selected property group from subpanelcontext's searchState
 * @param {Object} searchState subPanelContext's searchState
 */
export let clearPropGrpAndPropsData = function( searchState ) {
    var tmpState = { ...searchState.value };
    tmpState.selectedPropertyGroup = null;
    searchState.update( tmpState );
};

export default exports = {
    detectNode,
    setAppClassData,
    clearPropGrpAndPropsData,
    getAttributes,
    formatDataAndResponse
};
