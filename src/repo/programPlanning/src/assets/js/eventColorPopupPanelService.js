// Copyright (c) 2022 Siemens

/**
 * @module js/eventColorPopupPanelService
 */
import _ from 'lodash';
import appCtx from 'js/appCtxService';
import _soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

/**
 * Method for reading the preference and getting values in the panel.
 * @param {data} data view model data of popup panel
 * @return {Object} propertyList information
 */
export let setEventPropertiesOnPopupPanel = ( data ) => {
    let selectedDefaultPropertyName = 'none';
    let radioListArray = [];
    let radioDataToBePushed = {};
    // read site preference values to show property display name on popup panel
    let prefValueArray = appCtx.ctx.preferences.PP_Event_Color_Coding_Configuration;
    if( !prefValueArray || prefValueArray.length === 0 ) {
        return getPropertyListInformation( data, radioListArray, selectedDefaultPropertyName );
    }
    let userPreferenceInfo = data.getPreferenceValueResponse.preferences;
    // read user prefererence value to set default value on popup panel
    if( userPreferenceInfo && userPreferenceInfo.length > 0 && userPreferenceInfo[ 0 ].values ) {
        let userPrefValues = userPreferenceInfo[ 0 ].values;
        if( userPrefValues.length > 0 ) {
            selectedDefaultPropertyName = userPrefValues[ 0 ].split( ':' ).length === 3 ? userPrefValues[ 0 ] : 'none';
        }
    }
    let mapBOProperty = new Map();
    let typeNames = [];

    prefValueArray.forEach( businessObject => {
        let prefValueInfo = businessObject.split( ':' );
        if( prefValueInfo && prefValueInfo.length === 3 ) {
            let keyBO = prefValueInfo[ 0 ];
            let propInfos = [];
            let propInfo = {};
            propInfo.propName = prefValueInfo[ 1 ];
            propInfo.lovName = prefValueInfo[ 2 ];
            propInfos.push( propInfo );
            // create business object vs propertynames with lovs map
            mapBOProperty = getEventBOMapWithMultipleValues( mapBOProperty, keyBO, propInfos );
        }
    } );
    if( mapBOProperty.size ) {
        for( const [ key, propertyValues ] of mapBOProperty.entries() ) {
            typeNames.push( key );
        }
        // load business object and assign display name of 
        // property to radio button list
        return _soaSvc.ensureModelTypesLoaded( typeNames ).then( function() {
            let timeLineSearchBy = data.i18n.TimelineSearchBy;
            _.forEach( typeNames, function( typeName ) {
                let typeDesc = cmm.getType( typeName );
                if( typeDesc ) {
                    let nameOfBO = typeDesc.name;
                    let propInfos = mapBOProperty.get( nameOfBO );
                    // read all properties and get its display name
                    _.forEach( propInfos, function( propInfo ) {
                        let propInternalName = propInfo.propName;
                        if( typeDesc.name && propInternalName && typeDesc.propertyDescriptorsMap[ propInternalName ] && typeDesc.propertyDescriptorsMap[ propInternalName ]
                            .name ) {
                            // assign interal and display name to radio button list
                            let internalName = typeDesc.name + ':' + typeDesc.propertyDescriptorsMap[ propInternalName ].name + ':' + propInfo.lovName;
                            radioDataToBePushed = {
                                propDisplayValue: timeLineSearchBy + ' ' + typeDesc.propertyDescriptorsMap[ propInternalName ].displayName,
                                propInternalValue: internalName
                            };
                            radioListArray.push( radioDataToBePushed );
                        }
                    } );
                }
            } );
            if( radioListArray.length === 0 ) {
                selectedDefaultPropertyName = 'none';
            }
            return getPropertyListInformation( data, radioListArray, selectedDefaultPropertyName );
        } );
    }
    if( radioListArray.length === 0 ) {
        selectedDefaultPropertyName = 'none';
    }
    return getPropertyListInformation( data, radioListArray, selectedDefaultPropertyName );
};

/**
 * Method to get all property list and default property name radio button 
 * @param {Object} data view model data of popup panel
 * @param {Array} radioListArray radio button list
 * @param {string} selectedDefaultPropertyName select default property name
 * @return {Object} propertyList information
 */
let getPropertyListInformation = ( data, radioListArray, selectedDefaultPropertyName ) => {
    let defaulColorDisplayValue = data.i18n.Pgp0SetDefaultColor;
    // assign and add default value in popup panel 
    let radioDataToBePushed = {
        propDisplayValue: defaulColorDisplayValue,
        propInternalValue: 'none'
    };
    radioListArray.push( radioDataToBePushed );
    return {
        radioListArray: radioListArray,
        defaultPropertyName: selectedDefaultPropertyName
    };
};

/**
 * Method to get multiple values for BO name key
 * @param {map} map map
 * @param {string} keyBO key 
 * @param {Array} values values
 * @returns {map} map with multiple values
 */
let getEventBOMapWithMultipleValues = ( map, keyBO, values ) => {
    if( !map.size ) {
        map.set( keyBO, values );
    } else {
        if( map.has( keyBO ) ) {
            for( const [ businessObject, arrayOfValues ] of map.entries() ) {
                if( keyBO === businessObject ) {
                    var children = values.concat( arrayOfValues );
                    values = children;
                    map.delete( businessObject );
                }
            }
            map.set( keyBO, values );
        } else if( !map.has( keyBO ) ) {
            map.set( keyBO, values );
        }
    }
    return map;
};

export default exports = {
    setEventPropertiesOnPopupPanel
};
