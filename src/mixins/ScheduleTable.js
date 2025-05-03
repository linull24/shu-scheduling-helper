import html2canvas from 'html2canvas';
import { getPeriods, isMacLike } from '../utils/courseUtils';
import { getColor } from '../utils/colorUtils';


export const ScheduleTableMixin = {
  data() {
    return {
      classPeriods: [
        ['8:00', '8:45'],
        ['8:55', '9:40'],
        ['10:00', '10:45'],
        ['10:55', '11:40'],
        ['13:00', '13:45'],
        ['13:55', '14:40'],
        ['15:00', '15:45'],
        ['15:55', '16:40'],
        ['18:00', '18:45'],
        ['18:55', '19:40'],
        ['20:00', '20:45'],
        ['20:55', '21:40'],
      ],
      venueMode: false,
      capturing: false,
      colorSeedShortcut: isMacLike ? '⇧⌘K' : 'Ctrl+Shift+K',
    };
  },
  computed: {
    rows() {
      if (this.$store.state.previewClass == null) {
        return this.$store.getters.scheduleTableRows;
      } else {
        let rows = JSON.parse(JSON.stringify(this.$store.getters.scheduleTableRows));
        rows.forEach((row, i) => {
          row.forEach((cell, j) => {
            if (cell !== null
              && (cell.courseId === this.$store.state.previewClass.courseId
                || this.$store.state.previewClassConflicts.hasOwnProperty(cell.courseId))) {
              rows[i][j] = null;
            }
          });
        });
        getPeriods(this.$store.state.previewClass.classTime).forEach((period) => {
          rows[period[0]][period[1]] = {
            courseId: this.$store.state.previewClass.courseId,
            courseName: this.$store.state.previewClass.courseName,
            teacherId: this.$store.state.previewClass.teacherId,
            teacherName: this.$store.state.previewClass.teacherName,
            first: period[2],
            span: period[3],
            color: getColor(this.$store.state.previewClass.courseName, 0),
            isPreview: true,
            fortnight: period[4] ? period[4] + '周' : null,
            lab: period[5],
          };
        });
        return rows;
      }
    },
    noPeriodClasses() {
      let keys = Object.keys(this.$store.state.selectedClasses);
      keys = keys.filter((courseId) => {
        let teacherId = this.$store.state.selectedClasses[courseId].teacherId;
        return getPeriods(this.$store.state.reservedClasses[courseId].classes[teacherId].classTime).length === 0;
      });
      return keys.map((courseId) => {
        let teacherId = this.$store.state.selectedClasses[courseId].teacherId;
        return {
          courseId,
          teacherId,
          courseName: this.$store.state.reservedClasses[courseId].courseName,
          teacherName: this.$store.state.reservedClasses[courseId].classes[teacherId].teacherName,
          color: this.$store.state.selectedClasses[courseId].themeColor,
        };
      });
    },
  },
  methods: {
    handleClassCardClick(courseId) {
      this.$store.commit('OPEN_COURSE_ID', courseId);
      this.$emit('click');
    },
    saveImage() {
      this.capturing = true;
      const hide = this.$message.loading('正在截图...');
      this.$nextTick(() => {
        setTimeout(() => {
          html2canvas(this.$refs.wrapper, {
            scale: 3,
            width: 480,
            scrollX: 0,
            scrollY: 0,
            windowWidth: 480,
          }).then((canvas) => {
            canvas.toBlob((blob) => {
              this.$showSaveImageDialog(blob);
            });
          }).catch(() => {
            this.$message.error('截图失败！');
          }).finally(() => {
            this.capturing = false;
            hide();
          });
        }, 0);
      });
    },
  },
};

export const ClassCardMixin = {
  data() {
    return {
      courseNameParts: this.getCourseNameParts(),
      timer: null,
    };
  },
  computed: {
    clipPath() {
      const offset = 8;
      const mode = this.$store.state.settings?.clipPathMode || 'top-left';
      
      switch (mode) {
        case 'top-left':
          return `polygon(0 0, 0 calc(100% - ${offset}px), calc(100% - ${offset}px) 0`;
        case 'bottom-right':
          return `polygon(100% 100%, ${offset}px 100%, 100% ${offset}px)`;
        case 'full':
        default:
          return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
      }
    },
    style () {
      const defaultColor = '#888888'; // Default gray color
      const color = this.course?.color || defaultColor;
      return {
        'classic': [
          {
            color: 'rgba(255, 255, 255, 0.95)',
            borderColor: `rgba(${parseInt(color.substr(1, 2), 16)}, ${parseInt(color.substr(3, 2), 16)}, ${parseInt(color.substr(5, 2), 16)}, 1.0)`, 
            background: `rgba(${parseInt(color.substr(1, 2), 16)}, ${parseInt(color.substr(3, 2), 16)}, ${parseInt(color.substr(5, 2), 16)}, 0.75)`,
            opacity: this.course?.isPreview ? '0.5' : '1',
            padding: '4px 5px 5px',
            'border-top-width': '3px',
            'border-top-style': 'solid',
            'border-radius': '2px',
            'clip-path': this.clipPath,
            'background-clip': 'padding-box',
          },
          {
            color: 'rgba(255, 255, 255, 0.85)',
          },
        ],
        'candy': [
          {
            color: `rgba(${parseInt(color.substr(1, 2), 16)}, ${parseInt(color.substr(3, 2), 16)}, ${parseInt(color.substr(5, 2), 16)}, 1.0)`,
            background: `rgba(${parseInt(color.substr(1, 2), 16)}, ${parseInt(color.substr(3, 2), 16)}, ${parseInt(color.substr(5, 2), 16)}, 0.3)`,
            opacity: this.course?.isPreview ? '0.5' : '1',
            padding: '8px 6px 5px',
            'border-radius': '8px',
            margin: '1px',
            'clip-path':  this.clipPath,
            'background-clip': 'padding-box',
          },
          {
            color: `rgba(${parseInt(color.substr(1, 2), 16)}, ${parseInt(color.substr(3, 2), 16)}, ${parseInt(color.substr(5, 2), 16)}, 0.8)`,
          },
        ]
      }
    },
    _class() {
      return {
        'class-card': true,
        'class-card-hover': this.isHover,
      };
    },
    isHover() {
      if (this.capturing) {
        return false;
      }
      return this.$store.state.hoverCourseId === this.course.courseId;
    },
    courseName() {
      return this.courseNameParts.join('');
    },
  },
  watch: {
    course: {
      handler() {
        this.doShortenCourseName();
      },
      deep: true,
    },
  },
  mounted() {
    this.doShortenCourseName();
    window.addEventListener('resize', this.handleResize);
  },
  beforeDestroy() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    getCourseNameParts() {
      const parts = [];
      let courseName = this.course.courseName;
      while (courseName.length > 0) {
        const regexp = /(?:\w|\([^()]+\))$/i;
        const result = regexp.exec(courseName);
        if (result != null) {
          parts.unshift(result[0]);
          courseName = courseName.slice(0, -result[0].length);
        } else {
          parts.unshift(courseName);
          courseName = '';
        }
      }
      return parts;
    },
    handleResize() {
      if (this.timer !== null) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(async () => {
        await this.doShortenCourseName();
        clearTimeout(this.timer);
        this.timer = setTimeout(async () => {
          await this.doShortenCourseName();
          await this.adjustAllTextElements();
        }, 500);
      }, 0);
    },
    async doShortenCourseName() {
      this.courseNameParts = this.getCourseNameParts();
      await this.$nextTick();
      const lastLength = [0, 0];
      while (Math.max(21, this.$refs.courseName.clientHeight) !== Math.max(21, this.$refs.courseName.scrollHeight)) {
        this.shortenCourseNameParts();
        lastLength.push(this.courseName.length);
        lastLength.shift();
        if (lastLength[0] === lastLength[1]) {
          break;
        }
        await this.$nextTick();
      }
      await this.adjustAllTextElements();
    },

    async adjustAllTextElements() {
      await this.$nextTick();
      const elements = [
        this.$refs.courseName,
        this.$refs.teacherNameVenue,
        this.$refs.venueRef,
        this.$refs.venueAtRef,
        this.$refs.extraRef
      ].filter(Boolean);

      
      const CONFIG = {
        MAX_ITERATIONS: 10,
        INITIAL_STEP_RATIO: 1.0,
        MIN_STEP_RATIO: 0.85,
        CLIP_OFFSET: 8,
        MIN_FONT_SIZE: 8,
        MIN_LINE_CHARS: 3,
        Z_INDEX_TOP: 9999,
        DEBUG_OUTLINE: false
      };

      for (const el of elements) {
        if (!el) continue;

        
        const resetStyles = {
          fontSize: '',
          lineHeight: '',
          padding: '',
          whiteSpace: '',
          overflow: '',
          textOverflow: '',
          zIndex: '',
          outline: ''
        };
        Object.assign(el.style, resetStyles);
        await this.$nextTick();

        let iterations = 0;
        let currentFontSize = parseFloat(
          window.getComputedStyle(el).fontSize || CONFIG.MIN_FONT_SIZE
        );
        let stepRatio = CONFIG.INITIAL_STEP_RATIO;

        
        while (iterations < CONFIG.MAX_ITERATIONS && currentFontSize > CONFIG.MIN_FONT_SIZE) {
          const rect = el.getBoundingClientRect();
          const clipRect = this.$el.getBoundingClientRect();

          
          const overflow = {
            right: Math.max(0, rect.right - (clipRect.right - CONFIG.CLIP_OFFSET)),
            bottom: Math.max(0, rect.bottom - (clipRect.bottom - CONFIG.CLIP_OFFSET)),
            left: Math.max(0, (clipRect.left + CONFIG.CLIP_OFFSET) - rect.left),
            top: Math.max(0, (clipRect.top + CONFIG.CLIP_OFFSET) - rect.top)
          };

          if (Object.values(overflow).every(v => v <= 0)) break;

          const widthRatio = (clipRect.width - 2 * CONFIG.CLIP_OFFSET) / rect.width;
          const heightRatio = (clipRect.height - 2 * CONFIG.CLIP_OFFSET) / rect.height;
          const requiredRatio = Math.min(widthRatio, heightRatio);
          const effectiveRatio = Math.min(requiredRatio, stepRatio);

          currentFontSize = Math.max(
            CONFIG.MIN_FONT_SIZE,
            currentFontSize * effectiveRatio
          );
          el.style.fontSize = `${currentFontSize}px`;
          el.style.lineHeight = `${currentFontSize * 1.15}px`;
          el.style.padding = '1px 2px';

          //缩放步长
          stepRatio = Math.max(CONFIG.MIN_STEP_RATIO, stepRatio * 0.95);
          await this.$nextTick();
          iterations++;
        }

        // 最小字号
        if (currentFontSize <= CONFIG.MIN_FONT_SIZE) {
          el.style.whiteSpace = 'normal';
          el.style.wordWrap = 'break-word';
          await this.$nextTick();

          // 短行
          const hasShortLine = this.checkShortLastLine(el, CONFIG.MIN_LINE_CHARS);

          if (hasShortLine) {
            Object.assign(el.style, {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              zIndex: CONFIG.Z_INDEX_TOP.toString()
            });

            if (CONFIG.DEBUG_OUTLINE) {
              el.style.outline = '2px dashed rgba(255,0,0,0.3)';
              el.style.outlineOffset = '-1px';
            }
          } else {
            el.style.zIndex = '';
            el.style.overflow = 'visible';
          }
        }
      }
    },

    checkShortLastLine(el, minChars) {
    
      const text = el.textContent.trim();
      const words = text.split(/\s+/g);
      
      if (words.length >= 2) {
        const lastTwoWords = words.slice(-2).join('');
        if (lastTwoWords.length < minChars) return true;
      }

       
      
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects());
      
      if (rects.length > 1) {
        const lastLineRect = rects[rects.length - 1];
        const avgCharWidth = el.offsetWidth / text.length;
        const estimatedChars = Math.floor(lastLineRect.width / avgCharWidth);
        return estimatedChars < minChars;
      }
      
        
      
    },
  
    shortenCourseNameParts() {
      const parts = this.courseNameParts.slice();
      if (parts.length === 0) {
        return;
      }
      let index = parts.length - 1;
      let maxLength = 1;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!/\w|\((?:\w{1,2}|\W)\)/.test(parts[i])) {
          const lengthCanBeShorten = parts[i]
            .replace(/^\(/, '')
            .replace(/\)$/, '')
            .replace(/…$/, '')
            .length;
          if (lengthCanBeShorten > maxLength) {
            maxLength = lengthCanBeShorten;
            index = i;
          }
        }
      }
      if (maxLength > 1) {
        parts[index] = parts[index]
          .replace(/[^()]+/, (value) =>
            `${value.slice(0, 1)}${value.slice(1, value.endsWith('…') ? -2 : -1)}…`);
      }
      this.courseNameParts = parts;
    },
    handleMouseEnter() {
      this.$store.commit('HOVER_COURSE_ID', this.course.courseId);
    },
    handleMouseLeave() {
      if (this.$store.state.hoverCourseId === this.course.courseId) {
        this.$store.commit('HOVER_COURSE_ID', null);
      }
    },
  },
}
