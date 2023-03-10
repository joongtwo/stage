// Copyright (c) 2022 Siemens

import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import viewModelObjectSvc from 'js/viewModelObjectService';

var exports = {};

export let loadFrequencyColumns = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    var firstColumnConfigCol = {
        name: 'object_name',
        displayName: data.grids.frequencyList.i18n.FrequencyName,
        minWidth: 100,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        isTreeNavigation: true
    };
    var secondColumnConfigCol = {
        name: 'ssp0FrequencyExpression',
        displayName: data.grids.frequencyList.i18n.FrequencyExpression,
        minWidth: 100,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        typeName: 'STRING',
        pinnedLeft: false
    };
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );
    awColumnSvc.createColumnInfo( awColumnInfos );
    deferred.resolve(
        {
            columnConfig: {
                columns: awColumnInfos
            }
        }
    );
    return deferred.promise;
};

export let setNodeProperties = function( response ) {
    let objectsToReturn = [];
    if ( response.modelObjects !== undefined ) {
        var modelObjects = response.modelObjects || response.data.modelObjects;
        Object.values( modelObjects ).filter( obj => obj.modelType.typeHierarchyArray.includes( 'SSP0FrequencyRevision' ) ).forEach( function( modelObjectJson ) {
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObjectJson, 'create', undefined, undefined, true );
            vmo.displayName = modelObjectJson.props.object_name.dbValues[0];
            vmo.isVisible = false;
            vmo.isLeaf = true;
            objectsToReturn.push( vmo );
        }
        );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};

export default exports = {
    loadFrequencyColumns,
    setNodeProperties
};
