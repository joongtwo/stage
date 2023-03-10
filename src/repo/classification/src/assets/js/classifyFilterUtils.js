// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the response of the getAttributes2 classification SOA to be compatible with the generic
 * property widgets.
 *
 * @module js/classifyFilterUtils
 */
import appCtxSvc from 'js/appCtxService';
import AwTimeoutService from 'js/awTimeoutService';
import classifyTblSvc from 'js/classifyFullviewTableService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/*
 * Filters item that match the given term.
 *
 * @param {Object} item - item to be searched
 * @param {String} term - term to be searched
 * @param {boolean} filter - true/false to set visibility
 *
 * @returns item if term matches, null otherwise
 */
let filterItems = function( item, term, filter ) {
    item.visible = !filter;
    var tmpTerm = term.toLowerCase();
    var name = item.name.toLowerCase();
    var index = name.indexOf( tmpTerm );
    if( index > -1 ) {
        item.visible = true;
        return item;
    }

    return null;
};

/**
 * Splits search terms
 *
 * @param {String} text - keyword text
 * @return {Array}Returns array of split keywords
 */
function getSearchTerms( text ) {
    var _text = text;
    if( _text.indexOf( '*' ) > -1 ) {
        _text = _text.replace( /[*]/gi, ' ' );
    }
    // split search text on space
    return _text.split( ' ' );
}

/**
 * Highlight Keywords
 *
 * @param {Object} data search terms to highlight
 */
export let highlightKeywords = function( data ) {
    //Commenting out the highlighter code because it is not being used to highlight the classes
    /*if( data.propFilter === undefined || data.propFilter === '' || data.propFilter.trim() === '*' ) {
        appCtxSvc.ctx.clsTab.highlighter = undefined;
    } else {
        var searchTerms = getSearchTerms( data.propFilter );
        highlighterSvc.highlightKeywords( searchTerms );
    }*/
};

/*
 * Adds an item to the set if not available
 * @param items set of items
 * @param item item to add
 */
export let addItems = function( items, item ) {
    //search if item already exists in array
    var itemindex = _.findIndex( items, {
        name: item.name
    } );

    if( itemindex >= 0 ) {
        items.splice( itemindex, 1 );
    }
    items.push( item );
};


/**
 *
 * @param {Object} data Declartive view model
 * @param {Object} eventData  eventData
 */
export let propertyFilter = function( data ) {
    appCtxSvc.ctx.attributeProperties = [];

    if( data.eventData  === null ) {
        data.isFiltered = false;
    } else {
        data.isFiltered = true;
        data.filteredAttributes = [];
        data.filteredAttributes.push( data.eventData );
        data.nodeAttr = data.filteredAttributes;
        //When selecting a node, expand it automatically
        data.nodeAttr[ 0 ].propExpanded = true;
        if( data.propFilter.dbValue ) {
            exports.filterProperties( data, true );
        }
    }
};
/**
 * Filters cardinal block and its children that match the given term.
 *
 * @param {Object} block - item to be searched
 * @param {String} term - term to be searched
 * @param {boolean} propGroup - true if property group filter, false otherwise
 * @param {boolean} filter - true/false to set visibility
 * @param {integer} searchTermIndex - search term index
 * @param {Object} isAdmin - flag for admin location
 * @param {integer} found true if term found in block name
 * @returns {Object} block if term matches, null otherwise
 */
function filterCardinalBlock( block, term, propGroup, filter, searchTermIndex, found, isAdmin ) {
    filterItems( block.cardinalController, term, filter );
    found = found || block.cardinalController.visible;

    if( _.isEmpty( block.instances ) && !isAdmin ) {
        return found ? block : null;
    }
    //filter instance children
    var newInstSet = [];
    if( !isAdmin ) {
        for( var i = 0; i < block.instances.length; i++ ) {
            var inst = block.instances[ i ];
            var found1 = filterBlocks( inst, term, propGroup, filter, searchTermIndex );
            if( found1 ) {
                newInstSet.push( inst );
                block.visible = true;
            }
        }
    } else {
        //Special condition for admin
        _.forEach( block.children, function( item ) {
            item.visible = true;
        } );
    }

    return found || newInstSet.length > 0 ? block : null;
}

/*
 * Filters block and its children that match the given term.
 *
 * @param {Object} item - item to be searched
 * @param {String} term - term to be searched
 * @param {boolean} propGroup - true if property group filter, false otherwise
 * @param {boolean} filter - true/false to set visibility
 * @param {integer} searchTermIndex - search term index
 * @param {Object} isAdmin - Flag for admin location
 * @returns block if term matches, null otherwise
 */
let filterBlocks = function( block, term, propGroup, filter, searchTermIndex, isAdmin ) {
    var ctx = appCtxSvc.getCtx( 'clsTab' );
    if( !filter ) {
        //make all children visible
        block.visible = true;
    }
    var tmpBlock = block;
    var found = filterItems( tmpBlock, term, filter ) !== null;

    //check if cardinal block
    if( block.cardinalController && !isAdmin ) {
        return filterCardinalBlock( tmpBlock, term, propGroup, filter, searchTermIndex, found, isAdmin );
    } else if ( block.cardinalController && isAdmin ) {
        filterCardinalBlock( tmpBlock, term, propGroup, filter, searchTermIndex, found, isAdmin );
    }

    //check if polymorphic block
    var polyFound = false;

    if( block.polymorphicTypeProperty ) {
        filterItems( block.polymorphicTypeProperty, term, filter );
        polyFound = block.visible || block.polymorphicTypeProperty.visible;
    }

    var childVisible = false;
    for( var ii = 0; ii < block.children.length; ii++ ) {
        var item = block.children[ ii ];
        if( item.type === 'Block' ) {
            //search children
            filterBlocks( item, term, propGroup, filter, searchTermIndex, isAdmin );
            if( !childVisible ) {
                childVisible = item.visible;
            }
        } else if( !propGroup ) {
            if( found ) {
                item.visible = true;
            } else {
                //if an item found for previous term, ignore
                if( searchTermIndex > 0 && item.visible ) {
                    childVisible = item.visible;
                    continue;
                }
                filterItems( item, term, filter );
                if( !childVisible ) {
                    childVisible = item.visible;
                }
            }
        }
    }
    if( childVisible || polyFound ) {
        tmpBlock.visible = true;
    }

    return found || polyFound || childVisible && tmpBlock.children.length > 0 ? tmpBlock : null;
};

/*
 * Filters classes that match the term.
 *
 * @param {Object} items - list of item to be searched
 * @param {String} term - term to be searched
 * @param {boolean} propGroup - true if property group filter, false otherwise
 * @param {boolean} filter - true/false to set visibility
 * @param {integer} searchTermIndex - search term index
 * @param {Object} isAdmin - flag for classifciation admin
 * @returns list of items that matched the term
 */
let filterByType = function( items, term, propGroup, filter, searchTermIndex, isAdmin ) {
    var ctx = appCtxSvc.getCtx( 'clsTab' );

    var tmpItem = null;
    var tmpItems = [];

    _.filter( items, function( item ) {
        if( item.type === 'Block' ) {
            //search children
            tmpItem = filterBlocks( item, term, propGroup, filter, searchTermIndex, isAdmin );
        } else {
            tmpItem = searchTermIndex > 0 && item.visible ? item : filterItems( item, term, filter );
        }
        if( tmpItem ) {
            addItems( tmpItems, tmpItem );
        }
    } );

    return tmpItems;
};

/*
 * Filters properties/groups that match the term.
 *
 * @param {Object} items - list of item to be searched
 * @param {String} text - term to be searched
 * @param {boolean} propGroup - true if property group filter, false otherwise
 * @param {Object} isAdmin - CHeck for classification admin
 * @returns list of items that matched the term
 */
let filterProps = function( items, text, propGroup, isAdmin ) {
    text = text && text.length > 0 ? text.trim() : text;
    if( text === undefined || !text || text.length === 0 || _.isEqual( text, '*' ) ) {
        text = text ? text : '';
        tmpItems = filterByType( items, text, propGroup, false, null, isAdmin );
        return items;
    }
    var searchTerms = getSearchTerms( text );

    // search for single terms.
    var tmpItems;
    searchTerms.forEach( function( term, index ) {
        if( term && term.length ) {
            tmpItems = filterByType( items, term, propGroup, true, index, isAdmin );
        }
    } );

    return tmpItems;
};

/*
 * Filters selected block to display in properties section
 *
 * @param {Object} data - view model data
 * @param {Object} block- block attribute
 *
 */
export let filterSelectedBlock = function( data, attr ) {
    var found = false;
    if( attr.type === 'Block' ) {
        if( _.isEqual( attr.name, data.nodeAttr[ 0 ].name ) ) {
            data.filteredAttributes = [ attr ];
            found = true;
        } else {
            for( var i = 0; i < attr.children.length; i++ ) {
                var item = attr.children[ i ];
                found = exports.filterSelectedBlock( data, item );
                if( found ) {
                    break;
                }
            }
        }
    }
    return found;
};

/**
 *
 * Filters properties that match the term.
 *
 * @param {Object} data - view model data
 * @param {Object} isAdmin
 * @returns list of items that matched the term
 */
export let filterProperties = function( data, isAdmin ) {
    var ctxAdmin = appCtxSvc.getCtx( 'clsAdmin' );
    isAdmin = ctxAdmin !== undefined;

    data.propFilter = data.propFilter ? data.propFilter : {};
    data.filteredAttr_anno = filterProps( data.attr_anno, data.propFilter.dbValue, false, isAdmin );

    var ctx = appCtxSvc.getCtx( 'classifyTableView' );
    if( ctx && ctx.attribute && ctx.attribute.tableView && !ctx.attribute.noReload ) {
        classifyTblSvc.updateTableColumnData( data, ctx.attribute );
    }
    if( data.isFiltered ) {
        if( !_.isEmpty( data.propFilter.dbValue ) ) {
            data.filteredAttr_anno = filterProps( data.nodeAttr, data.propFilter.dbValue, false, isAdmin );
            data.filteredAttributes = data.filteredAttr_anno;
        } else {
            if( !data.filteredAttributes ) {
                var found;
                for( var attr in data.filteredAttr_anno ) {
                    found = exports.filterSelectedBlock( data, attr );
                    if( found ) {
                        break;
                    }
                }
            }
        }
    }
    return data.filteredAttr_anno;
};

/*
 * Filters property groups that match the term.
 *
 * @param {Object} data - view model data
 *
 * @returns list of items that matched the term
 */
export let filterPropGroups = function( attributes, filterString ) {
    if( appCtxSvc.ctx && appCtxSvc.ctx.locationContext &&
         appCtxSvc.ctx.locationContext &&
         appCtxSvc.ctx.locationContext['ActiveWorkspace:Location'] === 'com.siemens.splm.classificationManagerLocation' ) {
        return filterProps( attributes, filterString, true, true );
    }
    return filterProps( attributes, filterString, true );
};

var _timeout = null;


/* ToDo : This method needs refactoring as compared with classifySearchService::setSearchCriteria
*
 * Indicates when the search box is populated properly to perform a search.
 *
 * @param {Object} data - view model data
 * @param {Object} searchString - the search string that will be used on refresh.
 * @param {Object} providerName - the tree provider to refresh.
 * @param {Object} conditions - set of conditions.
 *
 * @returns data that has been updated with isTreeExpanding state or not.
 */
export let filterHierarchy = function( data, searchString, providerName, conditions ) {
    if( !_.isNull( _timeout ) ) {
        AwTimeoutService.instance.cancel( _timeout );
    }
    if( data.dataProviders[providerName].initializationComplete ) {
        if( data.initializationComplete || data.dataProviders.getClassTableSummary && data.dataProviders.getClassTableSummary.viewModelCollection.loadedVMObjects.length ) {
            _timeout = AwTimeoutService.instance( function() {
                if( searchString.length >= 1 &&
                    !conditions.isValidSearchInput
                ) {
                    eventBus.publish( providerName + '.invalidSearchString', {} );
                } else {
                    data.isTreeExpanding = false;
                    eventBus.publish( providerName + '.dataProvider.reset' );
                }
            }, 1500 );
        } else {
            data.initializationComplete = true;
        }
    }
    return data;
};

/**
 * Check if the search string is valid
 * @param {Object} searchString - Search string
 * @param {string} eventName - Name of the event.
 */
export let checkForInvalidSearch = function( searchString, eventName ) {
    if( searchString === '*' ) {
        throw new Error( 'failed' );
    } else {
        eventBus.publish( eventName, {} );
    }
};

export default exports = {
    checkForInvalidSearch,
    filterHierarchy,
    filterProperties,
    filterPropGroups,
    filterSelectedBlock
};
