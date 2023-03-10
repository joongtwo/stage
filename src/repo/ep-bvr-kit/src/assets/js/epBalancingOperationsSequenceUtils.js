// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 * 
 * @module js/epBalancingOperationsSequenceUtils
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import typeDisplayNameService from 'js/typeDisplayName.service';

const UI_CONSTANTS = {
    CONTAINERS_HEIGHT: 40,
    CONTAINER_SPACING: 10,
    CONTAINER_NAME_WIDTH: 1,
    CONTAINER_WORK_CONTENT_WIDTH: 1,
    RATIO_ANCHOR: 0.75,
    ITEMS_PADDING: 7,
    ITEMS_SPACING: 1,
    ITEM_HEIGHT: 26,
    PORT_SIZE: 5,
    TARGET_MARGINS: 3,
    LINE_TEXT_CHAR_SIZE: 7,
    AVAILABLE_TIME_MARGIN: 10,
    ARROW_RADIUS: 5
};

/**
 * 
 * @param {*} station  station
 * @param {*} processResoures  processResoures
 * @returns {*} 5
 */
export function prepareContainers( station, processResoures ) {
    const containers = [];
    const flows = [];
    _.forEach( processResoures, pr => {
        let allocateByPv = undefined;
        if ( pr.props.elb0allocatedOpsByPV ) {
            allocateByPv = pr.props.elb0allocatedOpsByPV.dbValues;
        }
        const ops = _
            .filter(
                allocateByPv,
                function( op ) {
                    const opObject = cdm.getObject( op );
                    let allocatedTime = 0;
                    if ( opObject.props.elb0allocatedTimeByPV ) {
                        allocatedTime = parseFloat( opObject.props.elb0allocatedTimeByPV.dbValues[0] );
                    }
                    return allocatedTime > 0;
                } );

        const prSharedWithStations = pr.props.elb0sharedWithStations.dbValues;
        const isShared = prSharedWithStations && prSharedWithStations.length > 1;
        const prName = typeDisplayNameService.instance.getDisplayName( pr );
        // eslint-disable-next-line no-bitwise
        const capacity = pr.props.capacity.dbValues[0] | 0; // convert to int
        const taktTime = parseFloat( pr.props.elb0taktTime.dbValues[0] );

        const container = {
            id: pr.uid,
            name: prName,
            time: parseFloat( pr.props.elb0workContentByPV.dbValues[0] ),
            items: processOperations( station, ops, flows ),
            shared: isShared,
            //tooltip: isShared ? getSharedPrTooltip( prSharedWithStations ) : prName,
            capacity: capacity,
            //capacityTooltip: self.resourceCapacityTooltip.format( capacity ),
            taktTime: taktTime,
            isHuman: isProcessResourceHuman( pr )
            //isSelected: isProcessResourceSelected( pr.uid ),
        };

        containers.push( container );
    } );

    //if ( containers.length > 0 ) {
    return {
        taktTime: parseFloat( station.props.elb0taktTime.dbValues[0] ),
        containers: containers,
        arrows: flows,
        cycleTime: parseFloat( station.props.elb0cycleTime.dbValues[0] )
        //externalTooltip: self.externalOperationTooltip
    };
}

const isProcessResourceHuman = ( pr ) => {
    const processResourceType = pr.props.mbc0processResourceType.dbValues[0];
    return processResourceType !== 'Machine';
};

/**
 * 
 * @param {*} ops  ops
 * @param {*} flows  flows
 * @returns {*} dd
 */
function processOperations( station, ops, flows ) {
    const items = [];
    _.forEach( ops, ( opUid, opIndex ) => {
        const op = cdm.getObject( opUid );
        const isExternal = op.props.bl_parent.dbValues[0] !== station.uid;

        const item = {
            id: op.uid,
            name: typeDisplayNameService.instance.getDisplayName( op ),
            allocatedTime: parseFloat( op.props.elb0allocatedTimeByPV.dbValues[0] ),
            startTime: parseFloat( op.props.elb0startTime.dbValues[0] ),
            external: isExternal,
            hasExternalFlow: false,
            hasWaitTimeAfter: false,
            hasWaitTimeBefore: false
        };
        item.endTime = parseFloat( item.startTime + item.allocatedTime );
        if ( parseInt( opIndex ) === 0 && item.startTime > 0 ) {
            item.hasWaitTimeBefore = true;
        } else if ( opIndex > 0 && items[opIndex - 1].endTime < item.startTime ) {
            items[opIndex - 1].hasWaitTimeAfter = true;
            item.hasWaitTimeBefore = true;
        }
        items.push( item );

        // handle flows
        let flowIndex = flows.length;
        const predecessors = op.props.Mfg0predecessors;
        if ( predecessors.dbValues.length > 0 ) {
            if ( isExternal ) {
                item.hasExternalFlow = true;
            } else {
                for ( const predIndex in predecessors.dbValues ) {
                    flows.push( {
                        id: flowIndex++,
                        fromID: predecessors.dbValues[predIndex],
                        toID: ops[opIndex]
                    } );
                }
            }
        }
    } );

    return items;
}

/**
 * 
 * @param {*} data 1
 * @param {*} scalingRatio 2
 * @param {*} operatorTimeText 3
 * @param {*} width 4
 * @returns {*} 5
 */
export function recalculateData( data, scalingRatio, operatorTimeText, width ) {
    const positions = calculateIndicatorLines( data, scalingRatio );
    const itemsMap = calculateContainers( data, scalingRatio, positions, operatorTimeText, width );
    calculateArrows( data, scalingRatio, itemsMap );
    return {
        positions: positions,
        items: itemsMap
    };
}

const buildPathCommand = function() {
    return _.toArray( arguments ).join( ' ' );
};

const addQCurve = function( control, after, isDown ) {
    const target = {};
    if ( after.y === control.y ) {
        target.x = control.x + UI_CONSTANTS.ARROW_RADIUS;
        target.y = control.y;
    } else {
        if ( isDown ) {
            target.x = control.x;
            target.y = control.y + UI_CONSTANTS.ARROW_RADIUS;
        } else {
            target.x = control.x;
            target.y = control.y - UI_CONSTANTS.ARROW_RADIUS;
        }
    }
    return buildPathCommand( 'Q', control.x, control.y, target.x, target.y );
};

const calculateArrowPath = function( x1, y1, x2, y2, x3, y3, x4, y4, isDown ) {
    const d = [];
    // start point:
    d.push( buildPathCommand( 'M', x1 - 5, y1 ) );
    d.push( buildPathCommand( 'L', x1, y1 ) );
    if ( x1 !== x4 ) {
        // first vertical line
        d
            .push( buildPathCommand( 'L', x2, isDown ? y2 - UI_CONSTANTS.ARROW_RADIUS : y2 +
                     UI_CONSTANTS.ARROW_RADIUS ) );
        // first curve 
        d.push( addQCurve( {
            x: x2,
            y: y2
        }, {
            x: x3,
            y: y3
        }, isDown ) );
        // horizontal line
        d.push( buildPathCommand( 'L', x3 - UI_CONSTANTS.ARROW_RADIUS, y3 ) );
        // second curve
        d.push( addQCurve( {
            x: x3,
            y: y3
        }, {
            x: x4,
            y: y4
        }, isDown ) );
    }
    // second vertical line
    d.push( buildPathCommand( 'L', x4, y4 ) );
    d.push( buildPathCommand( 'L', x4 + 5, y4 ) );
    return d.join( ' ' );
};

const calculateArrows = function( data, scalingRatio, itemsMap ) {
    for ( const arrowIndex in data.arrows ) {
        const arrow = data.arrows[arrowIndex];

        arrow.fromItem = itemsMap[arrow.fromID];
        arrow.toItem = itemsMap[arrow.toID];

        if ( arrow.fromItem && arrow.toItem ) {
            const isDown = arrow.fromItem.outport.y < arrow.toItem.inport.y;
            arrow.x1 = arrow.fromItem.endTime * scalingRatio + UI_CONSTANTS.CONTAINER_NAME_WIDTH;
            arrow.y1 = isDown ? arrow.fromItem.outport.y + 2 : arrow.fromItem.outport.y;
            arrow.x2 = arrow.toItem.startTime * scalingRatio + UI_CONSTANTS.CONTAINER_NAME_WIDTH;
            arrow.y2 = arrow.toItem.inport.y;
            arrow.middleY = isDown ? arrow.fromItem.y + UI_CONSTANTS.ITEM_HEIGHT + 12 : arrow.fromItem.y - 12;
            arrow.d = calculateArrowPath( arrow.x1, arrow.y1, arrow.x1, arrow.middleY, arrow.x2, arrow.middleY,
                arrow.x2, arrow.y2, isDown );
        }
    }
};

const calculateIndicatorLines = function( data, scalingRatio ) {
    const calculatedData = {};
    calculatedData.taktTimeX = UI_CONSTANTS.CONTAINER_NAME_WIDTH + data.taktTime * scalingRatio;
    calculatedData.cycleTimeX = UI_CONSTANTS.CONTAINER_NAME_WIDTH + data.cycleTime * scalingRatio;
    calculatedData.taktTimeTextX = calculatedData.taktTimeX - 5;
    calculatedData.cycleTimeTextX = calculatedData.cycleTimeX < 5 ? 0 : calculatedData.cycleTimeX - 5;
    // if the lines are too close - add margins to the text
    const cycleTimeTextLength = String( data.cycleTime.toFixed( 2 ) ).length;
    const taktTimeTextLength = String( data.taktTime.toFixed( 2 ) ).length;

    // cycle time <= takt time
    if ( data.cycleTime <= data.taktTime &&
             calculatedData.taktTimeX - calculatedData.cycleTimeX < UI_CONSTANTS.LINE_TEXT_CHAR_SIZE *
             cycleTimeTextLength ) {
        calculatedData.taktTimeTextX = calculatedData.taktTimeX;
        calculatedData.cycleTimeTextX = calculatedData.cycleTimeX - UI_CONSTANTS.LINE_TEXT_CHAR_SIZE *
                 cycleTimeTextLength;
    }
    // cycle time > takt time
    if ( data.cycleTime > data.taktTime &&
             calculatedData.cycleTimeX - calculatedData.taktTimeX < UI_CONSTANTS.LINE_TEXT_CHAR_SIZE *
             taktTimeTextLength ) {
        calculatedData.taktTimeTextX = calculatedData.taktTimeX - UI_CONSTANTS.LINE_TEXT_CHAR_SIZE *
                 taktTimeTextLength;
        calculatedData.cycleTimeTextX = calculatedData.cycleTimeX;
    }

    calculatedData.indicatorLineStart = 0;
    calculatedData.indicatorLineEnd = data.containers.length *
             ( UI_CONSTANTS.CONTAINERS_HEIGHT + UI_CONSTANTS.CONTAINER_SPACING ) - UI_CONSTANTS.CONTAINER_SPACING;
    return calculatedData;
};

const calculateContainers = function( data, scalingRatio, positions, operatorTimeText, width ) {
    const itemsMap = {};
    _.forEach( data.containers,
        function( container, index ) {
            container.y = index * ( UI_CONSTANTS.CONTAINERS_HEIGHT + UI_CONSTANTS.CONTAINER_SPACING );
            container.nameY = container.y + ( UI_CONSTANTS.CONTAINERS_HEIGHT + UI_CONSTANTS.CONTAINER_SPACING ) /
                     2 + 1;
            const yPos = container.y + UI_CONSTANTS.ITEMS_PADDING;
            container.axisY = yPos + UI_CONSTANTS.ITEM_HEIGHT + 1;
            container.axisX1 = UI_CONSTANTS.CONTAINER_NAME_WIDTH - 1;
            container.axisX2 = width;

            //initialize wait times data
            calculateGaps( container, scalingRatio, data.taktTime, yPos );

            //initialize items in each container.
            initializeItems( container, scalingRatio, data.taktTime, yPos, itemsMap );

            calculateAvailableTime( container, data, positions, operatorTimeText );
        } );
    return itemsMap;
};

const calculateGaps = function( container, scalingRatio, taktTime, yPos ) {
    if ( !container.isHuman ) {
        container.gaps = [];
        return;
    }
    let gapIndex = 0;
    const gaps = [];
    const addGap = function( gapStart, gapEnd ) {
        if ( gapStart < gapEnd ) {
            gaps.push( {
                id: gapIndex++,
                start: gapStart,
                time: gapEnd - gapStart
            } );
        }
    };

    let taktStart = 0;
    let taktEnd = taktTime;
    if ( container.capacity !== 100 ) {
        if ( container.items.length > 0 ) {
            taktStart = container.items[0].startTime;
        }
        taktEnd = container.taktTime + taktStart;
    }

    let start = 0;
    if ( container.items.length === 0 ) {
        addGap( start, taktEnd );
    } else {
        _.forEach( container.items, function( item ) {
            //If the capacity < 100 - no gap at the beginning
            if ( start >= taktStart ) {
                addGap( start, item.startTime );
            }
            start = item.startTime + item.allocatedTime;
        } );
        if ( start < taktEnd ) {
            //last gap before last operation and the takt time
            addGap( start, taktEnd );
        }
    }

    _.forEach( gaps, function( gap ) {
        gap.x = gap.start * scalingRatio + UI_CONSTANTS.CONTAINER_NAME_WIDTH; // the starting x position of the item.
        gap.y = yPos; // y position of the gap. adding 1px because of the border
        gap.width = gap.time * scalingRatio; // the width of the item = the scaled time.
    } );

    container.gaps = gaps;
};

const initializeItems = function( container, scalingRatio, taktTime, yPos, itemsMap ) {
    _.forEach( container.items, function( item ) {
        itemsMap[item.id] = item;
        // the starting x position of the item.
        item.x = item.startTime * scalingRatio + UI_CONSTANTS.CONTAINER_NAME_WIDTH;
        item.y = yPos; // y position of the item.
        // the width of the item = the scaled time.
        item.width = item.allocatedTime * scalingRatio;
        item.height = UI_CONSTANTS.ITEM_HEIGHT;

        // add separator between items
        if ( item.hasOwnProperty( 'hasWaitTimeAfter' ) && !item.hasWaitTimeAfter ) {
            item.width -= UI_CONSTANTS.ITEMS_SPACING;
        }

        // item is valid only if the end time is not bigger than the takt time
        if ( container.capacity < 100 ) {
            // if capacity < 100 - takt time calculation starts from the first operation
            item.valid = item.endTime <= container.taktTime + container.items[0].startTime;
        } else {
            item.valid = item.endTime <= container.taktTime;
        }
        item.inport = {
            x: item.x,
            y: yPos + UI_CONSTANTS.ITEM_HEIGHT / 2,
            visible: false
        };
        item.outport = {
            x: item.x + item.width,
            y: yPos + UI_CONSTANTS.ITEM_HEIGHT / 2,
            visible: false
        };
    } );
};

const calculateAvailableTime = function( container, data, positions, operatorTimeText ) {
    container.availableTime = ( container.taktTime - container.time ).toFixed( 2 );

    container.timeTooltip = operatorTimeText.format( container.name );
    const lastItem = _.last( container.items );
    if ( !lastItem || lastItem.valid ) {
        // no items in the container or last item is below takt time - available time will be displayed next to the takt time
        container.availableTimeX = positions.taktTimeX + UI_CONSTANTS.AVAILABLE_TIME_MARGIN;
    } else {
        // last item is above takt time - available time will be displayed next to the item
        container.availableTimeX = lastItem.x + lastItem.width + UI_CONSTANTS.AVAILABLE_TIME_MARGIN;
    }
};

export function getArrowHelper( data ) {
    return new ArrowHelper( data );
}

const ArrowHelper = function( data ) {
    this.data = data;
    this.previousTargetItem = undefined;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
};

ArrowHelper.prototype.startArrow = function( e, fromItem ) {
    this.mouseDeltaX = e.target.getBoundingClientRect().left - fromItem.x;
    this.mouseDeltaY = e.target.getBoundingClientRect().top - fromItem.y;
    const mouseX = e.pageX - this.mouseDeltaX;
    const mouseY = e.pageY - this.mouseDeltaY;
    this.current = {
        fromItem: fromItem,
        x1: fromItem.outport.x,
        y1: fromItem.outport.y,
        x2: mouseX,
        y2: mouseY,
        middleY: fromItem.outport.y
    };
};

ArrowHelper.prototype.drawArrow = function( e ) {
    const mouseX = e.pageX - this.mouseDeltaX;
    const mouseY = e.pageY - this.mouseDeltaY;

    let toItem = undefined;
    for ( const containerIndex in this.data.containers ) {
        for ( const itemIndex in this.data.containers[containerIndex].items ) {
            const item = this.data.containers[containerIndex].items[itemIndex];

            if ( this.current.fromItem !== item && !areItemsFromSameContainer( this.current.fromItem, item ) &&
                     item.x <= mouseX && mouseX <= item.x + item.width && item.y <= mouseY &&
                     mouseY <= item.y + UI_CONSTANTS.ITEM_HEIGHT ) {
                item.inport.visible = true;
                this.current.x2 = item.inport.x;
                this.current.y2 = item.inport.y;

                if ( this.previousTargetItem && this.previousTargetItem !== item ) {
                    this.previousTargetItem.inport.visible = false;
                }

                this.previousTargetItem = item;
                this.current.toItem = item;
                toItem = true;
                break;
            }
        }
    }
    if ( !toItem ) {
        if ( this.previousTargetItem ) {
            this.previousTargetItem.inport.visible = false;
        }
        this.current.x2 = mouseX;
        this.current.y2 = mouseY;
        this.current.toItem = undefined;
        const middleY = this.current.y1 < this.current.y2 ? this.current.y1 + UI_CONSTANTS.ITEM_HEIGHT
            : this.current.y1 - UI_CONSTANTS.ITEM_HEIGHT;
        this.current.middleY = middleY;
    }
};

const areItemsFromSameContainer = function( item1, item2 ) {
    return item1.y === item2.y;
};

ArrowHelper.prototype.isArrowValid = function() {
    return this.current.toItem && !this.current.toItem.external && !this.current.fromItem.external &&
             this.current.fromItem !== this.current.toItem &&
             !areItemsFromSameContainer( this.current.fromItem, this.current.toItem );
};

ArrowHelper.prototype.close = function() {
    this.current = {};
    if ( this.previousTargetItem ) {
        this.previousTargetItem.inport.visible = false;
        this.previousTargetItem = undefined;
    }
};

export function getMoveHelper( data ) {
    return new MoveHelper( data );
}

const MoveHelper = function( data ) {
    this.data = data;
    this.originalItem = undefined;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.movedItem = {
        x: 0,
        y: 0,
        height: UI_CONSTANTS.ITEM_HEIGHT,
        width: 0
    };
    this.target = {
        x: 0,
        y1: 0,
        y2: 0,
        container: undefined
    };
    this.isDroppingToNewPlace = false;
    this.predecessor = undefined;
    this.isDroppingInSameContainer = false;
    this.isAlreadyMoved = false;
};

MoveHelper.prototype.startMoving = function( e, containerIndex, itemIndex ) {
    const item = this.data.containers[containerIndex].items[itemIndex];
    this.movedItem.x = item.x;
    this.movedItem.y = item.y;
    this.movedItem.width = item.width;
    this.itemDeltaX = e.pageX - e.target.getBoundingClientRect().left;
    this.itemDeltaY = e.pageY - e.target.getBoundingClientRect().top;
    this.mouseDeltaX = e.target.getBoundingClientRect().left - item.x;
    this.mouseDeltaY = e.target.getBoundingClientRect().top - item.y;
    this.originalItem = item;
};

MoveHelper.prototype.moveItem = function( e ) {
    this.isDroppingInSameContainer = false;
    this.isDroppingToNewPlace = false;

    const mouseX = e.pageX - this.mouseDeltaX;
    const mouseY = e.pageY - this.mouseDeltaY;

    this.movedItem.x = mouseX - this.itemDeltaX;
    this.movedItem.y = mouseY - this.itemDeltaY;

    if ( Math.abs( this.movedItem.x - this.originalItem.x ) > 1 ||
             Math.abs( this.movedItem.y !== this.originalItem.y ) > 1 ) {
        this.isAlreadyMoved = true;
    }

    let container = undefined;
    let containerIndex = 0;
    while ( container === undefined && containerIndex < this.data.containers.length ) {
        const possibleTargetContainer = this.data.containers[containerIndex];
        if ( possibleTargetContainer.y <= mouseY &&
                 mouseY <= possibleTargetContainer.y + UI_CONSTANTS.CONTAINERS_HEIGHT ) {
            container = possibleTargetContainer;
        }
        containerIndex++;
    }

    // no container found - drop target invalid
    if ( !container ) {
        this.isDroppingToNewPlace = false;
        return;
    }

    // external operations
    this.isDroppingInSameContainer = _.includes( container.items, this.originalItem );

    if ( this.originalItem.external && !this.isDroppingInSameContainer ) {
        return;
    }

    // find new target position in container
    const containerYPos = container.y + UI_CONSTANTS.ITEMS_PADDING;
    this.target.y1 = containerYPos - UI_CONSTANTS.TARGET_MARGINS;
    this.target.y2 = containerYPos + UI_CONSTANTS.ITEM_HEIGHT + UI_CONSTANTS.TARGET_MARGINS;
    this.target.container = container;

    // if container is empty
    if ( container.items.length === 0 ) {
        this.isDroppingToNewPlace = true;
        this.target.x = UI_CONSTANTS.CONTAINER_NAME_WIDTH;
        this.predecessor = undefined;
        return;
    }

    // before first item
    const firstItem = _.first( container.items );
    if ( mouseX <= firstItem.x + firstItem.width / 2 - 1 && this.originalItem !== firstItem ) {
        this.isDroppingToNewPlace = true;
        this.target.x = UI_CONSTANTS.CONTAINER_NAME_WIDTH;
        this.predecessor = undefined;
        return;
    }

    // after last item
    const lastItem = _.last( container.items );
    if ( mouseX >= lastItem.x + lastItem.width / 2 + 1 && this.originalItem !== lastItem ) {
        this.isDroppingToNewPlace = true;
        this.target.x = lastItem.x + lastItem.width;
        this.predecessor = lastItem;
        return;
    }

    // between two items
    for ( let index = 0; index < container.items.length - 1; index++ ) {
        const leftItem = container.items[index];
        const rightItem = container.items[index + 1];
        if ( this.originalItem !== leftItem && this.originalItem !== rightItem ) {
            if ( leftItem.x + leftItem.width / 2 + 1 < mouseX && mouseX < rightItem.x + rightItem.width / 2 - 1 ) {
                this.isDroppingToNewPlace = true;
                this.target.x = leftItem.x + leftItem.width;
                this.predecessor = leftItem;
                break;
            }
        }
    }
};

MoveHelper.prototype.getPredecessor = function() {
    if ( this.isDroppingToNewPlace ) {
        return this.predecessor;
    }
    return undefined;
};

/**
 * srgr
 * @param {*} e ?
 * @param {*} item ? 
 * @returns {*} ??
 */
export function isMouseOnPortArea( e, item ) {
    const deltaX = e.pageX - e.target.getBoundingClientRect().left;
    const mouseX = item.x + deltaX;

    const maxRight = item.x + item.width;
    let maxLeft;
    if ( item.width / 2 > 10 ) {
        maxLeft = maxRight - 10;
    } else {
        maxLeft = item.x + item.width / 2;
    }

    return maxLeft <= mouseX && mouseX <= maxRight;
}

export default {
    prepareContainers,
    recalculateData,
    UI_CONSTANTS
};

