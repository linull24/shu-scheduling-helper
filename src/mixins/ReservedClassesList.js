import { getPeriods } from '../utils/course';
import { getColor } from '../utils/color';


export const ReservedClassesListMixin = {
  data() {
    return {
      hideConflict: false,
    };
  },
  computed: {
    reservedClasses() {
      return this.$store.state.reservedClasses;
    },
    reservedClassesKeys() {
      let keys = Object.keys(this.reservedClasses);
      keys.sort((a, b) => {
        let tA = this.$store.state.selectedClasses.hasOwnProperty(a) ? 1 : 0,
          tB = this.$store.state.selectedClasses.hasOwnProperty(b) ? 1 : 0;
        return tA === tB ? a.localeCompare(b) : tA - tB;
      });
      return keys;
    },
    shownReservedClassesKeys() {
      return this.reservedClassesKeys.filter(key => !(this.hideConflict && this.allConflicted[key]));
    },
    reservedClassesDividers() {
      let result = {
        unselectedCourse: -1,
        selectedCourse: -1,
      };
      for (let i = 0; i < this.shownReservedClassesKeys.length; i++) {
        if (i === 0 && !this.$store.state.selectedClasses.hasOwnProperty(this.shownReservedClassesKeys[i])) {
          result.unselectedCourse = 0;
        }
        if (this.$store.state.selectedClasses.hasOwnProperty(this.shownReservedClassesKeys[i])) {
          result.selectedCourse = i;
          break;
        }
      }
      return result;
    },
    credits() {
      return this.$store.getters.credits;
    },
    allConflicted() {
      let result = {};
      this.reservedClassesKeys.forEach((key) => {
        let flag = false;
        if (!this.$store.state.selectedClasses.hasOwnProperty(key)) {
          flag = true;
          for (let teacherId in this.$store.state.reservedClasses[key].classes) {
            if (this.$store.state.reservedClasses[key].classes.hasOwnProperty(teacherId)) {
              let isConflicted = false;
              const currentClassPeriods = getPeriods(this.$store.state.reservedClasses[key].classes[teacherId].classTime);
              
              for (let i = 0; i < currentClassPeriods.length; i++) {
                const period = currentClassPeriods[i];
                const currentWeekType = period[4]; 
                
                if (!isConflicted) {
                  let cells = this.$store.getters.scheduleTableRows[period[0]][period[1]];
                  if (cells.length > 0 && !cells.every(cell => cell.courseId === key)) {
                    let realConflict = false;
                    
                    for (let j = 0; j < cells.length; j++) {
                      const cell = cells[j];
                      if (cell.courseId === key) continue;
                      const conflictCourseId = cell.courseId;
                      const conflictTeacherId = this.$store.state.selectedClasses[conflictCourseId].teacherId;
                      const conflictClassTime = this.$store.state.reservedClasses[conflictCourseId].classes[conflictTeacherId].classTime;
                      const conflictPeriods = getPeriods(conflictClassTime);

                      const conflictPeriod = conflictPeriods.find(p => 
                        p[0] === period[0] && p[1] === period[1]
                      );

                      if (conflictPeriod) {
                        const conflictWeekType = conflictPeriod[4]; 
                        if ((currentWeekType === '单' && conflictWeekType === '双') || 
                            (currentWeekType === '双' && conflictWeekType === '单')) {
                          continue;
                        } else {
                          realConflict = true;
                          break;
                        }
                      } else {
                        realConflict = true;
                        break;
                      }
                    }
                    
                    if (realConflict) {
                      isConflicted = true;
                    }
                  } else {
                    let campusCell = this.$store.getters.campusTableRows[period[0]][period[1]];
                    if (campusCell != null && campusCell !== this.$store.state.reservedClasses[key].classes[teacherId].campus) {
                      const cellBefore = period[0] - 1 >= 0 ? this.$store.getters.scheduleTableRows[period[0] - 1][period[1]] : null;
                      const cellAfter = period[0] + 1 < 12 ? this.$store.getters.scheduleTableRows[period[0] + 1][period[1]] : null;

                      if (cellBefore != null && cellBefore.courseId !== this.id) {

                        const conflictCourseId = cellBefore.courseId;
                        const conflictTeacherId = this.$store.state.selectedClasses[conflictCourseId].teacherId;
                        const conflictClassTime = this.$store.state.reservedClasses[conflictCourseId].classes[conflictTeacherId].classTime;
                        const conflictPeriods = getPeriods(conflictClassTime);
                        const conflictPeriod = conflictPeriods.find(p => 
                          p[0] === period[0] - 1 && p[1] === period[1]
                        );
                        
                        if (!(conflictPeriod && currentWeekType && conflictPeriod[4] && 
                            ((currentWeekType === '单' && conflictPeriod[4] === '双') || 
                             (currentWeekType === '双' && conflictPeriod[4] === '单')))) {
                          if (cellBefore.campus !== this.$store.state.reservedClasses[key].classes[teacherId].campus) {
                            isConflicted = true;
                          }
                        }
                      }

                      if (!isConflicted && cellAfter != null && cellAfter.courseId !== this.id) {
                        const conflictCourseId = cellAfter.courseId;
                        const conflictTeacherId = this.$store.state.selectedClasses[conflictCourseId].teacherId;
                        const conflictClassTime = this.$store.state.reservedClasses[conflictCourseId].classes[conflictTeacherId].classTime;
                        const conflictPeriods = getPeriods(conflictClassTime);

                        const conflictPeriod = conflictPeriods.find(p => 
                          p[0] === period[0] + 1 && p[1] === period[1]
                        );
                        
                        if (!(conflictPeriod && currentWeekType && conflictPeriod[4] && 
                            ((currentWeekType === '单' && conflictPeriod[4] === '双') || 
                             (currentWeekType === '双' && conflictPeriod[4] === '单')))) {
                          if (cellAfter.campus !== this.$store.state.reservedClasses[key].classes[teacherId].campus) {
                            isConflicted = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
              
              if (!isConflicted) {
                flag = false;
                break;
              }
            }
          }
        }
        result[key] = flag;
      });
      return result;
    },
    openedCourseId: {
      get() {
        return this.$store.state.openedCourseId;
      },
      set(value) {
        this.$store.commit('OPEN_COURSE_ID', value);
      },
    },
  },
  methods: {
    scrollTo(courseId) {
      this.$nextTick(() => {
        setTimeout(() => {
          const element = this.$refs[`course-${courseId}`][0].$el;
          const panel = element.querySelector('.ant-collapse-content');
          const doScrollTo = () => {
            // noinspection JSUnresolvedVariable
            scrollTo({
              top: element.offsetTop + this.offset,
              behavior: 'smooth',
            });
            ['webkitTransitionEnd', 'mozTransitionEnd', 'MSTransitionEnd', 'otransitionend', 'transitionend'].forEach((value) => {
              panel.removeEventListener(value, doScrollTo);
            });
          };
          if (panel.classList.contains('ant-motion-collapse')) {
            ['webkitTransitionEnd', 'mozTransitionEnd', 'MSTransitionEnd', 'otransitionend', 'transitionend'].forEach((value) => {
              panel.addEventListener(value, doScrollTo);
            });
          } else {
            doScrollTo(element);
          }
        }, 0);
      });
    },
  },
};

export const CourseClassesListMixin = {
  data() {
    return {
      storageBusy: false,
    };
  },
  computed: {
    classesKeys() {
      let keys = Object.keys(this.course.classes).filter(key => key !== this.selectedClassKey);
      keys.sort();
      return keys;
    },
    shownClassesKeys() {
      return this.classesKeys.filter(key => !(this.hideConflict && this.isConflicted(key)));
    },
    selectedClassKey() {
      if (this.$store.state.selectedClasses.hasOwnProperty(this.id)) {
        return this.$store.state.selectedClasses[this.id].teacherId;
      } else {
        return null;
      }
    },
    conflicts() {
      let result = {};
      this.classesKeys.forEach((key) => {
        let courseConflicts = {};
        const currentClassPeriods = getPeriods(this.$store.state.reservedClasses[this.id].classes[key].classTime);
        
        currentClassPeriods.forEach((period) => {

          const currentWeekType = period[4]; 
          
          let cells = this.$store.getters.scheduleTableRows[period[0]][period[1]];
          if (cells.length > 0) {
            cells.forEach(cell => {
              if (cell !== null && cell.courseId !== this.id) {
                
                const conflictCourseId = cell.courseId;
                const conflictTeacherId = this.$store.state.selectedClasses[conflictCourseId].teacherId;
                const conflictClassTime = this.$store.state.reservedClasses[conflictCourseId].classes[conflictTeacherId].classTime;
                const conflictPeriods = getPeriods(conflictClassTime);

                const conflictPeriod = conflictPeriods.find(p => 
                  p[0] === period[0] && p[1] === period[1]
                );

                if (conflictPeriod) {
                  const conflictWeekType = conflictPeriod[4]; 

                  if ((currentWeekType === '单' && conflictWeekType === '双') || 
                      (currentWeekType === '双' && conflictWeekType === '单')) {
                    //continue;
                  } else {
                    courseConflicts[cell.courseId] = 1;
                  }
                } else {
                  courseConflicts[cell.courseId] = 1;
                }
              }
            });
          }
          

          let campusCells = this.$store.getters.campusTableRows[period[0]][period[1]];
          if (campusCells.length > 0) {
            const currentCampus = this.$store.state.reservedClasses[this.id].classes[key].campus;
            const hasDifferentCampus = campusCells.some(campus => campus !== currentCampus);
            
            if (hasDifferentCampus) {
              const cellsBefore = period[0] - 1 >= 0 ? this.$store.getters.scheduleTableRows[period[0] - 1][period[1]] : [];
              const cellsAfter = period[0] + 1 < 12 ? this.$store.getters.scheduleTableRows[period[0] + 1][period[1]] : [];
              

              cellsBefore.forEach(cell => {
                if (cell !== null && cell.campus !== currentCampus && cell.courseId !== this.id && courseConflicts[cell.courseId] == null) {

                  const conflictCourseId = cell.courseId;
                  const conflictTeacherId = this.$store.state.selectedClasses[conflictCourseId].teacherId;
                  const conflictClassTime = this.$store.state.reservedClasses[conflictCourseId].classes[conflictTeacherId].classTime;
                  const conflictPeriods = getPeriods(conflictClassTime);
                
                  const conflictPeriod = conflictPeriods.find(p => 
                    p[0] === period[0] - 1 && p[1] === period[1]
                  );
                  
                  if (conflictPeriod && currentWeekType && conflictPeriod[4] && 
                      ((currentWeekType === '单' && conflictPeriod[4] === '双') || 
                       (currentWeekType === '双' && conflictPeriod[4] === '单'))) {
                    //continue;
                  } else {
                    courseConflicts[cell.courseId] = 2;
                  }
                }
              });

              cellsAfter.forEach(cell => {
                if (cell !== null && cell.campus !== currentCampus && cell.courseId !== this.id && courseConflicts[cell.courseId] == null) {
                  const conflictCourseId = cell.courseId;
                  const conflictTeacherId = this.$store.state.selectedClasses[conflictCourseId].teacherId;
                  const conflictClassTime = this.$store.state.reservedClasses[conflictCourseId].classes[conflictTeacherId].classTime;
                  const conflictPeriods = getPeriods(conflictClassTime);
                  

                  const conflictPeriod = conflictPeriods.find(p => 
                    p[0] === period[0] + 1 && p[1] === period[1]
                  );
                  
                  if (conflictPeriod && currentWeekType && conflictPeriod[4] && 
                      ((currentWeekType === '单' && conflictPeriod[4] === '双') || 
                       (currentWeekType === '双' && conflictPeriod[4] === '单'))) {
                    //continue;
                  } else {
                    courseConflicts[cell.courseId] = 2;
                  }
                }
              });
            }
          }
        });
        result[key] = courseConflicts;
      });
      return result;
    },
  },
  methods: {
    isConflicted(key) {
      return Object.keys(this.conflicts[key]).length > 0;
    },
    selectClass(key) {
      this.$store.commit('OPEN_COURSE_ID', null);
      return this.$store.dispatch('selectClass', {
        'course_id': this.id,
        'teacher_id': key,
      });
    },
    unselectClass() {
      this.$emit('unselect', this.id);
      return this.$store.dispatch('unselectClass', {
        'course_id': this.id,
        'teacher_id': this.selectedClassKey,
      });
    },
    removeReservedClass(key) {
      this.storageBusy = true;
      this.$store.dispatch('removeReservedClass', {
        'course_id': this.id,
        'teacher_id': key,
      }).then(() => {
        this.storageBusy = false;
      });
    },
    previewClass(key) {
      this.$store.commit('PREVIEW_CLASS', {
        courseId: this.id,
        courseName: this.course.courseName,
        teacherId: key,
        teacherName: this.course.classes[key].teacherName,
        classTime: this.course.classes[key].classTime,
      });
      this.$store.commit('PREVIEW_CLASS_CONFLICTS', this.conflicts[key]);
    },
    cancelPreviewClass(key) {
      if (this.$store.state.previewClass !== null
        && this.$store.state.previewClass.courseId === this.id
        && this.$store.state.previewClass.teacherId === key) {
        this.$store.commit('PREVIEW_CLASS', null);
      }
    },
    conflictsSolving(key) {
      this.showConflictsSolvingDialog({
        course_id: this.id,
        course_name: this.course.courseName,
        teacher_id: key,
        teacher_name: this.course.classes[key].teacherName,
        class_time: this.course.classes[key].classTime,
      }, this.conflicts[key]);
    },
  },
};

export const CourseColorMixin = {
  computed: {
    style() {
      if (this.$store.state.selectedClasses.hasOwnProperty(this.courseId)) {
        return {
          background: this.$store.state.selectedClasses[this.courseId].themeColor,
        };
      } else {
        return {
          background: getColor(this.courseName, this.seed),
        };
      }
    },
  },
};

export const CourseMetaMixin = {
  computed: {
    selectedClassKey() {
      if (this.$store.state.selectedClasses.hasOwnProperty(this.id)) {
        return this.$store.state.selectedClasses[this.id].teacherId;
      } else {
        return null;
      }
    },
  },
};
