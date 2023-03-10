// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to load Part
*
* @module js/ssp0PartsService
*/
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import iconService from 'js/iconService';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';

let exports = {};
const RESOURCE_MESSAGE = 'ssp0Messages';

/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} data data
 * @return {Object} TreeLoadResult of node
 */
export let setTreeProperties = function( response, data ) {
    let objectsToReturn = [];
    if ( response.modelObjects !== undefined ) {
        const modelObjects = response.modelObjects || response.data.modelObjects;
        Object.values( modelObjects ).filter( modelObject => modelObject.props && modelObject.props.bl_line_name
            && modelObject.props.bl_occ_type && modelObject.props.bl_item_object_type && ( modelObject.props.bl_item_object_type.dbValues[0] === servicePlannerConstants.TYPE_PART
            || modelObject.props.bl_item_object_type.dbValues[0] === servicePlannerConstants.TYPE_ITEM )  ).forEach(
            modelObject => {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject, 'create', undefined, undefined, true );
                if ( vmo.props.bl_occ_type ) {
                    let vmProp = uwPropertySvc.createViewModelProperty( 'bl_occ_type', 'Occurrence Type', 'STRING',
                        vmo.props.bl_occ_type.dbValues[0], [ vmo.props.bl_occ_type.dbValues[0] ] );
                    uwPropertySvc.setIsEditable( vmProp, false );
                    uwPropertySvc.setEditState( vmProp, false );
                    uwPropertySvc.setHasLov( vmProp, true );
                    uwPropertySvc.setIsRequired( vmProp, true );
                    vmo.props.bl_occ_type = vmProp;
                }
                if ( vmo.props.bl_item_object_desc ) {
                    vmo.props.bl_item_object_desc.isPropertyModifiable = false;
                    vmo.props.bl_item_object_desc.isEditable = false;
                }
                vmo.propertyDescriptor = {
                    displayName: vmo.propertyDisplayName
                };
                vmo.getViewModel = function() {
                    return data;
                };
                vmo.displayName = modelObject.props.bl_line_name.dbValues[0];
                vmo.typeIconURL = iconService.getTypeIconURL( servicePlannerConstants.TYPE_PART_REVISION );
                vmo.isVisible = false;
                vmo.isLeaf = true;
                objectsToReturn.push( vmo );
            } );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};

/**
 * Get child nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} data data of ViewModel
 * @return {Array.Object} Array of modelObjects
 */
export const getChildNodes = function( response, data ) {
    const selectedVMO = response.plain[0];
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    let input = [];
    data.childExist = false;

    if ( modelObjects && modelObjects[selectedVMO].uid && modelObjects[selectedVMO].props.bl_child_lines && modelObjects[selectedVMO].props.bl_child_lines.dbValues.length > 0 ) {
        found = true;
        data.childExist = true;
        const objects = modelObjects[selectedVMO].props.bl_child_lines.dbValues;
        input = _getMfg0BvrPartObjects( objects );
        return input;
    }

    if ( !found ) {
        data.treeLoadResult = { response: [], totalFound: 0 };
    }
    return input;
};

/**
 * Get part nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} data data of ViewModel
 * @return {Array.Object} Array of modelObjects
 */
export const getPartNodes = function( response, data ) {
    const selectedVMO = response.plain[0];
    let modelObjects = undefined;
    if ( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if ( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    let input = [];
    data.childExist = false;
    if ( modelObjects && modelObjects[selectedVMO].uid && modelObjects[selectedVMO].props.Mfg0all_material && modelObjects[selectedVMO].props.Mfg0all_material.dbValues.length > 0 ) {
        found = true;
        data.childExist = true;
        const objects = modelObjects[selectedVMO].props.Mfg0all_material.dbValues;
        input = _getMfg0BvrPartObjects( objects );
        return input;
    }


    if ( !found ) {
        data.treeLoadResult = { response: [], totalFound: 0 };
    }
    return input;
};

let _getMfg0BvrPartObjects = function( objects ) {
    let input = [];
    objects.forEach( o => input.push( {
        uid: o
    } ) );
    return input;
};

/**
 * Reload the Parts Tree
 * @param {Object} dataProvider dataProvider of parts tree
 */
export let reloadPartsTree = function( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        eventBus.publish( 'partsTree.plTable.reload' );
    }
};

/**
 * Edit the table
 */
export let startEdit = function() {
    //Start editing the table
};

/**
 * Validate selection for group or role LOV and if it is valid, use the selection to filter user data
 *
 * @param {Object} selected selected object if any, else null.
 * @param {String} suggestion Filter string value if filter string does not match any object.
 * @returns {Object} The object contains selection validity result.
 */
export let validateSelection = function( selected, suggestion ) {
    let valid = true;
    if ( selected.length > 0 && selected[0].propInternalValue === '' ) {
        valid = false;
        let localTextBundle = localeService.getLoadedText( RESOURCE_MESSAGE );
        msgSvc.showError( localTextBundle.occTypeEmptyError );
    } else {
        valid = suggestion.some( occType => occType.propInternalValue !== selected[0].propInternalValue );
    }
    return {
        valid: valid
    };
};

/**
 * Get Occurrence Type List
 * @param {Object} response response of SOA
 * @return {Array} array of occurrence Type List
 */
export let getOccTypeList = function( response ) {
    let occTypeList = [];
    const responseArray = response.response;
    for ( let key in responseArray ) {
        const values = responseArray[key].values.values;
        Object.values( values ).filter( value => !occTypeList.some( occType => occType.propDisplayValue === value ) ).forEach( value=>{
            occTypeList.push( {
                propDisplayValue: value,
                propInternalValue: value,
                propDisplayDescription: '',
                hasChildren: false,
                children: {},
                sel: false

            } );
        } );
    }
    return occTypeList;
};

/**
 * Get Preferences Names List
 * @param {Object} response response of SOA
 * @return {Array} array of occurrence Type List
 */
export let getPreferencesNamesList = function( response ) {
    let validPreferencesList = new Set();
    const values = response.response[0].values.values;
    Object.values( values ).filter( value => value.includes( ':Item:' ) ).forEach( value => {
        let splitArray = value.split( ':' );
        if ( splitArray[2] ) {
            splitArray[2].split( ',' ).forEach( item => validPreferencesList.add( item ) );
        }
    } );
    return Array.from( validPreferencesList );
};

/**
 * render function for AwLovEdit
 * @param { * } props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awCustomLOVComponentRenderFunction = ( props ) => {
    const { viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.occTypesProvider;

    const passedProps = { ...prop, fielddata };


    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadPartsTreeTableColumns = function( data ) {
    const localizeDisplayName = data.grids.partsTree.i18n;
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    const zerothColumnConfigCol = {
        name: 'graphicVisibility',
        width: 30,
        enableFiltering: false,
        enableColumnResizing: true,
        pinnedLeft: true,
        columnOrder: 90
    };
    const firstColumnConfigCol = {
        name: 'bl_line_name',
        displayName: localizeDisplayName.nameValueColumn,
        width: 285,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true
    };
    const secondColumnConfigCol = {
        name: 'bl_occ_type',
        displayName: localizeDisplayName.occTypeValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        renderingHint: 'OccurrenceTypeProvider',
        typeName: 'STRING',
        pinnedLeft: false
    };
    const thirdColumnConfigCol = {
        name: 'bl_item_object_desc',
        displayName: localizeDisplayName.descriptionValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: false
    };
    awColumnInfos.push( zerothColumnConfigCol );
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos.push( thirdColumnConfigCol );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );

    return deferred.promise;
};

/**
 * Refresh the Parts Tree
 */
export let refreshPartsTree = function() {
    if ( appCtxSvc.ctx.is3DTabPresent ) {
        eventBus.publish( 'partsTree.plTable.clientRefresh' );
    }
};


export default exports = {
    refreshPartsTree,
    getPartNodes,
    awCustomLOVComponentRenderFunction,
    getPreferencesNamesList,
    getOccTypeList,
    validateSelection,
    loadPartsTreeTableColumns,
    startEdit,
    getChildNodes,
    setTreeProperties,
    reloadPartsTree
};
