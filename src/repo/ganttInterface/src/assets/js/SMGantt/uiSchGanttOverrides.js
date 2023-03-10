//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/SMGantt/uiSchGanttOverrides
 */
import ganttManager from 'js/uiGanttManager';
import appCtx from 'js/appCtxService';
import dateTimeSvc from 'js/dateTimeService';


var exports = {};

var layers = []; // Cache layers : Before adding need to check whether layer is present on the gantt or not.

/**
 * Method for adding the overrides.
 *
 */

export let addOverrides = function( dataSource ) {
    //Overrides
    ganttManager.getGanttInstance().isCriticalTask = function( task ) {
        return dataSource.isCriticalTask( task.id );
    };
    ganttManager.getGanttInstance().isCriticalLink = function( link ) {
        return dataSource.isLinkCritical( link.id );
    };

   
    ganttManager.getGanttInstance()._render_pair = function( e, clsName, task, a ) {
        var state = ganttManager.getGanttInstance().getState();
        if( clsName === 'gantt_task_drag' ) {
            //For Schedule Summary task, Summary task and Proxy task don't add both left and right drag bands.
            if( task.taskType !== 2 && task.taskType !== 5 && task.taskType !== 6 ) {
                var isFinishDateSch = dataSource.isFinishDateSchedule( task.id );
                if( isFinishDateSch ) {
                    Number( task.start_date ) >= Number( state.min_date ) && e.appendChild( a( clsName + ' task_left' ) );
                } else {
                    Number( task.start_date ) >= Number( state.min_date ) && e.appendChild( a( clsName + ' task_right' ) );
                }
            }
        } else {
            Number( task.end_date ) <= Number( state.max_date ) && e.appendChild( a( clsName + ' task_right' ) ),
                Number( task.start_date ) >= Number( state.min_date ) && e.appendChild( a( clsName + ' task_left' ) );
        }
    };
    ganttManager.getGanttInstance()._get_visible_milestone_width = function() {
        //set it to hardcoded 20 as width for milestone is specified in smGanttCustomStyles.css
        var e = dataSource.hasBaseline() ? 10 : 20;
        return Math.sqrt( 2 * e * e );
    };

    ganttManager.getGanttInstance()._render_grid_item = function( e ) {
        if( !ganttManager.getGanttInstance()._is_grid_visible() ) { return null; }
        for( var i, n = this.getGridColumns(), a = [], s = 0; s < n.length; s++ ) {
            var r;
            var o;
            var _;
            var l = s === n.length - 1;
            var d = n[ s ];
            if( 'add' === d.name ) {
                var h = this._waiAria.gridAddButtonAttrString( d );
                o = '<div ' + h + ' class=\'gantt_add\'></div>';
                    _ = '';
            } else {
                o = d.template ? d.template( e ) : e[ d.name ];
                    o instanceof Date && ( o = this.templates.date_grid( o, e ) );
                    _ = o;
                    o = '<div class=\'gantt_tree_content\'>' + o + '</div>';
            }
            var whatIfClassName = '';
            if( d.name === 'text' ) {
                if( e.whatIfMode === 1 && e.type !== 'scheduleSummary' ) {
                    whatIfClassName = ' task_added_in_whatif_mode';
                }
                if( e.hasWhatIfData && e.type !== 'scheduleSummary' ) {
                    whatIfClassName = ' modified_in_whatif_mode';
                }
            }
            var c = 'gantt_cell' + whatIfClassName + ( l ? ' gantt_last_cell' : '' );
            var u = '';
            if( d.tree ) {
                for( var g = 0; g < e.$level; g++ ) { u += this.templates.grid_indent( e ); }
                i = this._has_children( e.id ),
                    i ? ( u += this.templates.grid_open( e ),
                        u += this.templates.grid_folder( e ) ) : ( u += this.templates.grid_blank( e ),
                        u += this.templates.grid_file( e ) );
            }
            var f = 'width:' + ( d.width - ( l ? 1 : 0 ) ) + 'px;';
            this.defined( d.align ) && ( f += 'text-align:' + d.align + ';' );
            var h = this._waiAria.gridCellAttrString( d, _ );
            r = '<div class=\'' + c + '\' style=\'' + f + '\' ' + h + '>' + u + o + '</div>',
                a.push( r );
        }
        var c = ganttManager.getGanttInstance().getGlobalTaskIndex( e.id ) % 2 === 0 ? '' : ' odd';
        if( c += e.$transparent ? ' gantt_transparent' : '',
            c += e.$dataprocessor_class ? ' ' + e.$dataprocessor_class : '',
            this.templates.grid_row_class ) {
            var p = this.templates.grid_row_class.call( this, e.start_date, e.end_date, e );
            p && ( c += ' ' + p );
        }
        this.getState().selected_task === e.id && ( c += ' gantt_selected' );
        var v = document.createElement( 'div' );
        return v.className = 'gantt_row' + c,
            v.style.height = this.config.row_height + 'px',
            v.style.lineHeight = ganttManager.getGanttInstance().config.row_height + 'px',
            v.setAttribute( this.config.task_attribute, e.id ),
            this._waiAria.taskRowAttr( e, v ),
            v.innerHTML = a.join( '' ),
            v;
    };
    //The following code should be uncommented for custom drawing of dependency lines different from provide by DHX
    //oldGetPoints variable is never read is due to known bug in eclipse
    //https://bugs.eclipse.org/bugs/show_bug.cgi?id=351470
    //can be ignored.
    // var oldGetPoints = ganttManager.getGanttInstance()._path_builder.get_points;
    // ganttManager.getGanttInstance()._path_builder.get_points = function (link) {
    // if (link.type === ganttManager.getGanttInstance().config.links.start_to_start ||
    // link.type === ganttManager.getGanttInstance().config.links.finish_to_finish) {
    // return oldGetPoints.apply(this, arguments);
    // }

    // var pt = this.get_endpoint(link);
    // var xy = ganttManager.getGanttInstance().config;

    // var dy = pt.e_y - pt.y;
    // var dx = pt.e_x - pt.x;

    // var dir = ganttManager.getGanttInstance()._drawer.dirs;

    // this.clear();
    // this.point({
    // x: pt.x,
    // y: pt.y
    // });

    // var shiftX = 2 * xy.link_arrow_size;//just random size for first line
    // var forward;

    // switch (link.type) {
    // case ganttManager.getGanttInstance().config.links.finish_to_start:
    // forward = (pt.e_x > (pt.x + 2 * shiftX));
    // if (forward) {
    // dx -= shiftX;
    // this.point_to(dir.right, dx);
    // this.point_to(dir.down, dy);
    // this.point_to(dir.right, shiftX);
    // } else {
    // this.point_to(dir.right, shiftX);
    // dx -= 2 * shiftX;
    // var sign = dy > 0 ? 1 : -1;
    // this.point_to(dir.down, sign * (xy.row_height / 2));
    // this.point_to(dir.right, dx);
    // this.point_to(dir.down, sign * (Math.abs(dy) - (xy.row_height / 2)));
    // this.point_to(dir.right, shiftX);
    // }
    // break;
    // case ganttManager.getGanttInstance().config.links.start_to_finish:
    // forward = (pt.e_x > (pt.x - 2 * shiftX));

    // if (!forward) {
    // dx += shiftX;
    // this.point_to(dir.right, dx);
    // this.point_to(dir.down, dy);
    // this.point_to(dir.left, shiftX);
    // } else {
    // this.point_to(dir.left, shiftX);
    // dx += 2 * shiftX;
    // var sign1 = dy > 0 ? 1 : -1;
    // this.point_to(dir.down, sign1 * (xy.row_height / 2));
    // this.point_to(dir.right, dx);
    // this.point_to(dir.down, sign1 * (Math.abs(dy) - (xy.row_height / 2)));
    // this.point_to(dir.left, shiftX);
    // }
    // }

    // return this.path;
    // };
   ganttManager.getGanttInstance().resetProjectDates = function (t) {
       var i = n(t);
       if (i.$no_end || i.$no_start || t.taskType === 6) {
           var r = a(t.id);
           (function (t, n, i, r) {
               n.$no_start &&
                   (t.start_date = i ? new Date(i) : e(t, this.getParent(t)));
               n.$no_end &&
                   (t.end_date = r
                       ? new Date(r)
                       : this.calculateEndDate({
                             start_date: t.start_date,
                             duration:
                                 ganttManager.getGanttInstance().config
                                     .duration_step,
                             task: t
                         }));
               (n.$no_start || n.$no_end) &&
                   ganttManager.getGanttInstance()._init_task_timing(t);
           }.call(this, t, i, r.start_date, r.end_date),
               (t.$rollup = r.rollup));
       }
};

 };
 var e = function(e, n) {
     var i = !(!n || n === ganttManager.getGanttInstance().config.root_id) && ganttManager.getGanttInstance().getTask(n)
       , r = null;
     if (i)
     {
         r = ganttManager.getGanttInstance().config.schedule_from_end ? ganttManager.getGanttInstance().calculateEndDate({
             start_date: i.end_date,
             duration: -ganttManager.getGanttInstance().config.duration_step,
             task: e
         }) : i.start_date;
     }
     else if (ganttManager.getGanttInstance().config.schedule_from_end)
     {
         r = ganttManager.getGanttInstance().calculateEndDate({
             start_date: ganttManager.getGanttInstance()._getProjectEnd(),
             duration: -ganttManager.getGanttInstance().config.duration_step,
             task: e
         });
     }
     else {
         var a = ganttManager.getGanttInstance().getTaskByIndex(0);
         r = a ? a.start_date ? a.start_date : a.end_date ? ganttManager.getGanttInstance().calculateEndDate({
             start_date: a.end_date,
             duration: -ganttManager.getGanttInstance().config.duration_step,
             task: e
         }) : null : ganttManager.getGanttInstance().config.start_date || ganttManager.getGanttInstance().getState().min_date;
     }
     return ganttManager.getGanttInstance().assert(r, "Invalid dates"),
     new Date(r);
 };
 var n = function(e, n) {
     var i = ganttManager.getGanttInstance().getTaskType(e.type)
       , r = {
         type: i,
         $no_start: !1,
         $no_end: !1
     };
     return n || i !== e.$rendered_type ? (i === ganttManager.getGanttInstance().config.types.project? r.$no_end = r.$no_start = !0 : i !== ganttManager.getGanttInstance().config.types.milestone &&
      (r.$no_end = !(e.end_date || e.duration),
     r.$no_start = !e.start_date,
     ganttManager.getGanttInstance()._isAllowedUnscheduledTask(e) && (r.$no_end = r.$no_start = !1)),
     r) : (r.$no_start = e.$no_start,
     r.$no_end = e.$no_end,
     r);
 };

 function a(e) {
     var n = null
       , i = null
       , r = void 0 !== e ? e : ganttManager.getGanttInstance().config.root_id
       , a = [];
     return ganttManager.getGanttInstance().eachTask(function(e) {
         ganttManager.getGanttInstance().getTaskType(e.type) === ganttManager.getGanttInstance().config.types.project || ganttManager.getGanttInstance().isUnscheduledTask(e) || e.tasktype === 6
         || (e.rollup && a.push(e.id),
         e.start_date && !e.$no_start && (!n || n > e.start_date.valueOf()) && (n = e.start_date.valueOf()),
         e.end_date && !e.$no_end && (!i || i < e.end_date.valueOf()) && (i = e.end_date.valueOf()));
     }, r),
     {
         start_date: n ? new Date(n) : null,
         end_date: i ? new Date(i) : null,
         rollup: a
     };
 }

 function addBaselineTaskWithStyle(baselineEl, sizes, style){
    baselineEl.className = style;
    baselineEl.style.left = sizes.left + 'px';
    baselineEl.style.width = sizes.width + 'px';
    baselineEl.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 14 + 'px';
 }

function addBaselineMilestoneWithStyle(baselineEl, sizes, style){
    baselineEl.className = style;
    baselineEl.style.left = sizes.left - 4 + 'px';
    baselineEl.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 5 + 'px';
}

function addBaselineMilestoneWithStyle2(baselineEl, sizes, style){
    baselineEl.className = style;
    baselineEl.style.left = sizes.left - 4 + 'px';
    baselineEl.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 8 + 'px';
}

function addBaselineMilestoneWithStyle1(baselineEl, sizes, style){
    baselineEl.className = style;
    baselineEl.style.left = sizes.left - 4 + 'px';
    baselineEl.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 5 + 'px';
}

function addBaselineTaskWithStyle2( baselineEl, sizes, style ) {
    baselineEl.className = style;
    baselineEl.style.left = sizes.left + 'px';
    baselineEl.style.width = sizes.width + 'px';
    baselineEl.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 26 + 'px';
}

function addBaselineTaskWithStyle1( baselineEl, sizes, style ) {
    baselineEl.className = style;
    baselineEl.style.left = sizes.left + 'px';
    baselineEl.style.width = sizes.width + 'px';
    baselineEl.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 14 + 'px';
}

function removeTaskLayers( layers ) {
    layers.forEach( layer => {
        ganttManager.getGanttInstance().removeTaskLayer( layer );

    } );
    //reset the layers
    layers = [];
}

export let addTaskLayers = function( dataSource ) {
    //remove layer is already present in the gantt.
    removeTaskLayers( layers );

    var baselines = dataSource.getBaselines();

    for( const idx in baselines ) {

        let baseline = baselines[idx];
        var currentLayer = ganttManager.getGanttInstance().addTaskLayer( function draw_planned( task ) {

            var task_baselinesSch = task.id + "_" + baseline.uid;
            var baselineDates = dataSource.getBaselineTaskDates( task_baselinesSch );

            if( !baselineDates ) {
                return false;
            }

            var baselineStartDate = ganttManager.getGanttInstance().date.parseDate( baselineDates.startDate, 'xml_date' );
            var baselineEndDate = ganttManager.getGanttInstance().date.parseDate( baselineDates.endDate, 'xml_date' );

            var sizes = ganttManager.getGanttInstance().getTaskPosition( task, baselineStartDate, baselineEndDate );
            var baselineEl = document.createElement( 'div' );
            // for tooltip need startdate and finishdate and name of the baseline
            baselineEl.className = 'gantt_baseline';
            baselineEl.baselineStartDate = baselineStartDate;
            baselineEl.baselineEndDate = baselineEndDate;
            if( baseline.props && baseline.props.object_name ) {
                baselineEl.baselineName = baseline.props.object_name.displayValues[ 0 ];
            }

            if( baselineDates.startDate.getTime() === baselineDates.endDate.getTime() ) { // Milestone
                if( appCtx.ctx.layout === 'comfy' ) {
                    if( idx >= 1 ) {
                        addBaselineMilestoneWithStyle2( baselineEl, sizes, 'gantt_baseline gantt_baseline2_milestone' );
                    } else {
                        baselines.length > 1 ? addBaselineMilestoneWithStyle1( baselineEl, sizes, 'gantt_baseline gantt_baseline1_milestone' ) : addBaselineMilestoneWithStyle( baselineEl, sizes, 'gantt_baseline gantt_base_milestone_comfy' );
                    }
                }
                if( appCtx.ctx.layout === 'compact' ) {
                    if( idx >= 1 ) {
                        addBaselineMilestoneWithStyle2( baselineEl, sizes, 'gantt_baseline gantt_baseline2_milestone' );
                    } else {
                        baselines.length > 1 ? addBaselineMilestoneWithStyle1( baselineEl, sizes, 'gantt_baseline gantt_baseline1_milestone' ) : addBaselineMilestoneWithStyle( baselineEl, sizes, 'gantt_baseline gantt_base_milestone_compact' );
                    }
                }
            } else {
                if( appCtx.ctx.layout === 'comfy' ) {
                    if( idx >= 1 ) {
                        addBaselineTaskWithStyle2( baselineEl, sizes, 'gantt_baseline baseline2' );
                    } else {
                        baselines.length > 1 ? addBaselineTaskWithStyle1( baselineEl, sizes, 'gantt_baseline baseline1' ) : addBaselineTaskWithStyle( baselineEl, sizes, 'gantt_baseline gantt_baseline_comfy' );
                    }
                }
                if( appCtx.ctx.layout === 'compact' ) {
                    if( idx >= 1 ) {
                        addBaselineTaskWithStyle2( baselineEl, sizes, 'gantt_baseline baseline2' );
                    } else {
                        baselines.length > 1 ? addBaselineTaskWithStyle1( baselineEl, sizes, 'gantt_baseline baseline1' ) : addBaselineTaskWithStyle( baselineEl, sizes, 'gantt_baseline gantt_baseline_compact' );
                    }
                }
            }

            var baselineParentEl = document.createElement( 'div' );
            baselineParentEl.classList.add( 'baseline_properties' );
            //To show only dates for Baseline
            if( appCtx.ctx.showGanttTaskProperties === true ) {
                var baselineElLeftChild = document.createElement( 'div' );
                baselineElLeftChild.className = 'baseline_child_properties';
                baselineElLeftChild.innerHTML = dateTimeSvc.formatDate( baselineStartDate );
                baselineElLeftChild.style.left = sizes.left - 71 + 'px';
                if( task.taskType === 1 ) { //Milestone
                    baselineElLeftChild.style.left = sizes.left - 76 + 'px';
                }
                baselineElLeftChild.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 2 + 'px';
                //Add start date for left side
                baselineParentEl.appendChild( baselineElLeftChild );
                //Add baseline
                baselineParentEl.appendChild( baselineEl );

                var baselineElRightChild = document.createElement( 'div' );
                baselineElRightChild.className = 'baseline_child_properties';
                baselineElRightChild.innerHTML = dateTimeSvc.formatDate( baselineEndDate );
                baselineElRightChild.style.left = sizes.left + sizes.width + 15 + 'px';
                if( task.taskType === 1 ) { //Milestone
                    baselineElRightChild.style.left = sizes.left + sizes.width + 23 + 'px';
                }
                baselineElRightChild.style.top = sizes.top + ganttManager.getGanttInstance().config.bar_height + 2 + 'px';
                //Add end date for right side
                baselineParentEl.appendChild( baselineElRightChild );
            } else { // If task properties are not viewed , add baseline element to show baseline on Gantt
                baselineParentEl.appendChild( baselineEl );
            }

            return baselineParentEl;
        } );

        layers.push( currentLayer );
    }
};

export default exports = {
    addOverrides,
    addTaskLayers
};
