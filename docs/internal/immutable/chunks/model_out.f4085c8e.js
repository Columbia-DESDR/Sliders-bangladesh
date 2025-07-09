let e={sum_early:{name:"sum_early",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            source as (
                select * from __dbt__cte__fusion 
            ),
            intervel as (
                select * from source
                where dekad >= var(sum_early_first)
                  and dekad <= var(sum_early_last)
            ),
            rain_window as (
                select year, sum(value_cap) as window_value
                from intervel
                group by year
            ),
            trigger_exit as (
                select 
                    round(percentile_cont(1-var(freq)) 
                          within group (order by window_value asc)) 
                        as trigger_value,
                    round(max(window_value)) * var(exit_multiplier) 
                        as exit_value
                from rain_window
            ),
            output as (
                select * from rain_window
                cross join trigger_exit
                order by year
            )
            select * from output
        `},crop_cal:{name:"crop_cal",query:`
            with __dbt__cte__crop_cal_precast as (
                SELECT 
                    gid, 
                    crop, 
                    activity,
                    GREATEST((CAST(start_time AS DATE) - DATE '2024-01-01')/10, 1) 
                        as start_time,
                    GREATEST((CAST(end_time AS DATE) - DATE '2024-01-01')/10, 1) 
                        as end_time
                FROM crop_cal_raw
                WHERE gid='var(region)'
            )
            SELECT 
                gid, 
                crop, 
                activity, 
                start_time::INTEGER AS start_time, 
                end_time::INTEGER AS end_time
            FROM __dbt__cte__crop_cal_precast
        `},sum_late:{name:"sum_late",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            source as (
                select * from __dbt__cte__fusion 
            ),
            intervel as (
                select * from source
                where dekad >= var(sum_late_first)
                  and dekad <= var(sum_late_last)
            ),
            rain_window as (
                select year, sum(value_cap) as window_value
                from intervel
                group by year
            ),
            trigger_exit as (
                select 
                    round(percentile_cont(1-var(freq)) 
                          within group (order by window_value asc)) 
                        as trigger_value,
                    round(max(window_value)) * var(exit_multiplier) 
                        as exit_value
                from rain_window
            ),
            output as (
                select * from rain_window
                cross join trigger_exit
                order by year
            )
            select * from output
        `},crop_cal_precast:{name:"crop_cal_precast",query:`
            SELECT 
                gid, 
                crop, 
                activity, 
                GREATEST((CAST(start_time AS DATE) - DATE '2024-01-01')/10, 1) 
                    as start_time,
                GREATEST((CAST(end_time AS DATE) - DATE '2024-01-01')/10, 1) 
                    as end_time 
            FROM crop_cal_raw 
            WHERE gid='var(region)'
        `},severity_sum_late:{name:"severity_sum_late",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as ( 
                    select * from fusion_raw 
                ),
                gid_map as ( 
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region 
                    from unpivot_result a 
                    left join admin_raw b on a.gid = b.gid 
                ),
                filter_year_admin as ( 
                    select * from gid_map 
                    where gid = 'var(region)' 
                      and YEAR >= var(year_start) 
                      and YEAR <= var(year_end) 
                ),
                cap as ( 
                    select *, 
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap 
                    from filter_year_admin a 
                ),
                output as ( 
                    select dekad, year, * 
                    from cap 
                )
                select * from output
            ),
            __dbt__cte__sum_late as (
                with source as ( 
                    select * from __dbt__cte__fusion 
                ),
                intervel as ( 
                    select * from source 
                    where dekad >= var(sum_late_first) 
                      and dekad <= var(sum_late_last) 
                ),
                rain_window as ( 
                    select year, sum(value_cap) as window_value 
                    from intervel 
                    group by year 
                ),
                trigger_exit as ( 
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value 
                    from rain_window 
                ),
                output as ( 
                    select * from rain_window 
                    cross join trigger_exit 
                    order by year 
                )
                select * from output
            ),
            source as ( 
                select * from __dbt__cte__sum_late 
            ),
            severity_raw as ( 
                select *, 
                       case when EXIT_VALUE = TRIGGER_VALUE 
                            then 0 
                            else (TRIGGER_VALUE - WINDOW_VALUE )/(TRIGGER_VALUE- EXIT_VALUE ))  
                       end as severity_value 
                from source 
            ),
            output as ( 
                select year, 
                       case when severity_value < 0 then 0 
                            when severity_value > 1 then 1 
                            else severity_value 
                       end as severity 
                from severity_raw 
            )
            select * from output
        `},fusion:{name:"fusion",query:`
            with unpivot_result as (
                select * from fusion_raw
            ),
            gid_map as (
                select 
                    a.gid, 
                    a.year, 
                    a.value, 
                    a.dekad, 
                    b.region
                from unpivot_result a
                left join admin_raw b on a.gid = b.gid
            ),
            filter_year_admin as (
                select * from gid_map
                where gid = 'var(region)'
                  and YEAR >= var(year_start)
                  and YEAR <= var(year_end)
            ),
            cap as (
                select *,
                       case when value > var(dekcap) 
                            then var(dekcap) 
                            else value 
                       end as value_cap
                from filter_year_admin a
            ),
            output as (
                select dekad, year, *
                from cap
            )
            select * from output
        `},severity_sum_early:{name:"severity_sum_early",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            __dbt__cte__sum_early as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_early_first)
                      and dekad <= var(sum_early_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            source as (
                select * from __dbt__cte__sum_early
            ),
            severity_raw as (
                select *,
                       case when EXIT_VALUE = TRIGGER_VALUE 
                            then 0 
                            else (TRIGGER_VALUE - WINDOW_VALUE )/
                                 (TRIGGER_VALUE - EXIT_VALUE ) 
                       end as severity_value
                from source
            ),
            output as (
                select year,
                       case when severity_value < 0 then 0 
                            when severity_value > 1 then 1 
                            else severity_value 
                       end as severity
                from severity_raw
            )
            select * from output
        `},climatology:{name:"climatology",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            source as (
                select * from __dbt__cte__fusion 
            ),
            climatology as (
                select dekad, avg(value_cap) as average_value
                from source
                where dekad >= 1 
                  and dekad <= 36
                group by dekad
                order by dekad
            )
            select * from climatology
        `},severity_combined:{name:"severity_combined",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            __dbt__cte__sum_early as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_early_first)
                      and dekad <= var(sum_early_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            __dbt__cte__severity_sum_early as (
                with source as (
                    select * from __dbt__cte__sum_early
                ),
                severity_raw as (
                    select *,
                           case when EXIT_VALUE = TRIGGER_VALUE 
                                then 0 
                                else (TRIGGER_VALUE - WINDOW_VALUE )/
                                     (TRIGGER_VALUE - EXIT_VALUE ) 
                           end as severity_value
                    from source
                ),
                output as (
                    select year,
                           case when severity_value < 0 then 0 
                                when severity_value > 1 then 1 
                                else severity_value 
                           end as severity
                    from severity_raw
                )
                select * from output
            ),
            __dbt__cte__sum_late as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_late_first)
                      and dekad <= var(sum_late_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            __dbt__cte__severity_sum_late as (
                with source as (
                    select * from __dbt__cte__sum_late
                ),
                severity_raw as (
                    select *,
                           case when EXIT_VALUE = TRIGGER_VALUE 
                                then 0 
                                else (TRIGGER_VALUE - WINDOW_VALUE )/
                                     (TRIGGER_VALUE - EXIT_VALUE ) 
                           end as severity_value
                    from source
                ),
                output as (
                    select year,
                           case when severity_value < 0 then 0 
                                when severity_value > 1 then 1 
                                else severity_value 
                           end as severity
                    from severity_raw
                )
                select * from output
            ),
            source as (
                select 
                    a.year as year,
                    var(sum_early_weight) * a.severity + 
                    var(sum_late_weight) * b.severity as combined_severity,
                    a.severity as sum_early,
                    b.severity as sum_late
                from __dbt__cte__severity_sum_early a
                join __dbt__cte__severity_sum_late b on a.year = b.year
            )
            select * from source
        `},check:{name:"check",query:`
            with __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            __dbt__cte__sum_early as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_early_first)
                      and dekad <= var(sum_early_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            __dbt__cte__severity_sum_early as (
                with source as (
                    select * from __dbt__cte__sum_early
                ),
                severity_raw as (
                    select *,
                           case when EXIT_VALUE = TRIGGER_VALUE 
                                then 0 
                                else (TRIGGER_VALUE - WINDOW_VALUE )/
                                     (TRIGGER_VALUE - EXIT_VALUE ) 
                           end as severity_value
                    from source
                ),
                output as (
                    select year,
                           case when severity_value < 0 then 0 
                                when severity_value > 1 then 1 
                                else severity_value 
                           end as severity
                    from severity_raw
                )
                select * from output
            ),
            __dbt__cte__sum_late as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_late_first)
                      and dekad <= var(sum_late_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            __dbt__cte__severity_sum_late as (
                with source as (
                    select * from __dbt__cte__sum_late
                ),
                severity_raw as (
                    select *,
                           case when EXIT_VALUE = TRIGGER_VALUE 
                                then 0 
                                else (TRIGGER_VALUE - WINDOW_VALUE )/
                                     (TRIGGER_VALUE - EXIT_VALUE ) 
                           end as severity_value
                    from source
                ),
                output as (
                    select year,
                           case when severity_value < 0 then 0 
                                when severity_value > 1 then 1 
                                else severity_value 
                           end as severity
                    from severity_raw
                )
                select * from output
            ),
            __dbt__cte__severity_combined as (
                with source as (
                    select 
                        a.year as year,
                        var(sum_early_weight) * a.severity + 
                        var(sum_late_weight) * b.severity as combined_severity,
                        a.severity as sum_early,
                        b.severity as sum_late
                    from __dbt__cte__severity_sum_early a
                    join __dbt__cte__severity_sum_late b on a.year = b.year
                )
                select * from source
            )
            SELECT 
                CASE 
                    WHEN sum(a.combined_severity) > var(check_sensitivity) 
                     AND sum(a.sum_early) > var(check_sensitivity) 
                     AND sum(a.sum_late) > var(check_sensitivity) 
                    THEN 1 
                    ELSE 0 
                END 
            FROM __dbt__cte__severity_combined a
        `},badyear:{name:"badyear",query:`
            SELECT * 
            FROM badyear_raw 
            WHERE gid = 'var(region)' 
              AND is_bad_year = 1 
            ORDER BY variable 
            LIMIT (
                SELECT COUNT(DISTINCT year) 
                FROM badyear_raw 
                WHERE gid = 'var(region)'
            ) * var(freq)
        `},matching:{name:"matching",query:`
            with __dbt__cte__badyear as (
                SELECT * 
                FROM badyear_raw 
                WHERE gid='var(region)' 
                  AND is_bad_year = 1 
                ORDER BY variable
            ),
            __dbt__cte__fusion as (
                with unpivot_result as (
                    select * from fusion_raw
                ),
                gid_map as (
                    select 
                        a.gid, 
                        a.year, 
                        a.value, 
                        a.dekad, 
                        b.region
                    from unpivot_result a
                    left join admin_raw b on a.gid = b.gid
                ),
                filter_year_admin as (
                    select * from gid_map
                    where gid = 'var(region)'
                      and YEAR >= var(year_start)
                      and YEAR <= var(year_end)
                ),
                cap as (
                    select *,
                           case when value > var(dekcap) 
                                then var(dekcap) 
                                else value 
                           end as value_cap
                    from filter_year_admin a
                ),
                output as (
                    select dekad, year, *
                    from cap
                )
                select * from output
            ),
            __dbt__cte__sum_early as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_early_first)
                      and dekad <= var(sum_early_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            __dbt__cte__severity_sum_early as (
                with source as (
                    select * from __dbt__cte__sum_early
                ),
                severity_raw as (
                    select *,
                           case when EXIT_VALUE = TRIGGER_VALUE 
                                then 0 
                                else (TRIGGER_VALUE - WINDOW_VALUE )/
                                     (TRIGGER_VALUE - EXIT_VALUE ) 
                           end as severity_value
                    from source
                ),
                output as (
                    select year,
                           case when severity_value < 0 then 0 
                                when severity_value > 1 then 1 
                                else severity_value 
                           end as severity
                    from severity_raw
                )
                select * from output
            ),
            __dbt__cte__sum_late as (
                with source as (
                    select * from __dbt__cte__fusion 
                ),
                intervel as (
                    select * from source
                    where dekad >= var(sum_late_first)
                      and dekad <= var(sum_late_last)
                ),
                rain_window as (
                    select year, sum(value_cap) as window_value
                    from intervel
                    group by year
                ),
                trigger_exit as (
                    select 
                        round(percentile_cont(1-var(freq)) 
                              within group (order by window_value asc)) 
                            as trigger_value,
                        round(max(window_value)) * var(exit_multiplier) 
                            as exit_value
                    from rain_window
                ),
                output as (
                    select * from rain_window
                    cross join trigger_exit
                    order by year
                )
                select * from output
            ),
            __dbt__cte__severity_sum_late as (
                with source as (
                    select * from __dbt__cte__sum_late
                ),
                severity_raw as (
                    select *,
                           case when EXIT_VALUE = TRIGGER_VALUE 
                                then 0 
                                else (TRIGGER_VALUE - WINDOW_VALUE )/
                                     (TRIGGER_VALUE - EXIT_VALUE ) 
                           end as severity_value
                    from source
                ),
                output as (
                    select year,
                           case when severity_value < 0 then 0 
                                when severity_value > 1 then 1 
                                else severity_value 
                           end as severity
                    from severity_raw
                )
                select * from output
            ),
            __dbt__cte__severity_combined as (
                with source as (
                    select 
                        a.year as year,
                        var(sum_early_weight) * a.severity + 
                        var(sum_late_weight) * b.severity as combined_severity,
                        a.severity as sum_early,
                        b.severity as sum_late
                    from __dbt__cte__severity_sum_early a
                    join __dbt__cte__severity_sum_late b on a.year = b.year
                )
                select * from source
            )
            SELECT 
                a.gid, 
                b.year, 
                a.is_bad_year, 
                b.combined_severity, 
                b.sum_early, 
                b.sum_late 
            FROM __dbt__cte__badyear a 
            RIGHT JOIN __dbt__cte__severity_combined b ON a.year = b.year
        `}};export{e as m};
