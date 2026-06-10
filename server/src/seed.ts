import { getDb } from './db';
import { generateId, now, hashPassword, hashQuestion } from './utils';
import { createSubject, createKnowledgePoint } from './services/questionService';

function seedDatabase() {
  console.log('开始初始化种子数据...');
  
  const db = getDb();
  
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (adminExists) {
    console.log('种子数据已存在，跳过初始化');
    return;
  }
  
  console.log('创建用户...');
  const adminId = generateId();
  const teacherId = generateId();
  const studentId = generateId();
  const currentTime = now();
  
  db.prepare(`
    INSERT INTO users (id, username, email, password, real_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    adminId, 'admin', 'admin@exam.com',
    hashPassword('admin123'), '系统管理员', 'admin',
    currentTime, currentTime
  );
  
  db.prepare(`
    INSERT INTO users (id, username, email, password, real_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    teacherId, 'teacher', 'teacher@exam.com',
    hashPassword('teacher123'), '张老师', 'teacher',
    currentTime, currentTime
  );
  
  db.prepare(`
    INSERT INTO users (id, username, email, password, real_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studentId, 'student', 'student@exam.com',
    hashPassword('student123'), '李同学', 'student',
    currentTime, currentTime
  );
  
  console.log('创建科目...');
  const jsSubjectId = createSubject('JavaScript', 'JavaScript编程语言基础与进阶').id;
  const reactSubjectId = createSubject('React', 'React前端框架').id;
  
  console.log('创建知识点...');
  
  const jsBasicId = createKnowledgePoint({
    name: '基础语法',
    subjectId: jsSubjectId,
    level: 1,
    sort: 1
  }).id;
  
  const jsDataTypeId = createKnowledgePoint({
    name: '数据类型',
    parentId: jsBasicId,
    subjectId: jsSubjectId,
    level: 2,
    sort: 1
  }).id;
  
  const jsOperatorId = createKnowledgePoint({
    name: '运算符',
    parentId: jsBasicId,
    subjectId: jsSubjectId,
    level: 2,
    sort: 2
  }).id;
  
  const jsFuncId = createKnowledgePoint({
    name: '函数',
    subjectId: jsSubjectId,
    level: 1,
    sort: 2
  }).id;
  
  const jsAsyncId = createKnowledgePoint({
    name: '异步编程',
    subjectId: jsSubjectId,
    level: 1,
    sort: 3
  }).id;
  
  const jsPromiseId = createKnowledgePoint({
    name: 'Promise',
    parentId: jsAsyncId,
    subjectId: jsSubjectId,
    level: 2,
    sort: 1
  }).id;
  
  const reactBasicId = createKnowledgePoint({
    name: 'React基础',
    subjectId: reactSubjectId,
    level: 1,
    sort: 1
  }).id;
  
  const reactHooksId = createKnowledgePoint({
    name: 'Hooks',
    subjectId: reactSubjectId,
    level: 1,
    sort: 2
  }).id;
  
  const reactVdomId = createKnowledgePoint({
    name: '虚拟DOM',
    subjectId: reactSubjectId,
    level: 1,
    sort: 3
  }).id;
  
  console.log('创建题目...');
  
  const questions = [
    {
      type: 'single_choice' as const,
      difficulty: 'easy' as const,
      subjectId: jsSubjectId,
      content: '以下哪个是JavaScript的基本数据类型？',
      options: [
        { label: 'A', content: 'String', isCorrect: true },
        { label: 'B', content: 'Array', isCorrect: false },
        { label: 'C', content: 'Object', isCorrect: false },
        { label: 'D', content: 'Function', isCorrect: false }
      ],
      correctAnswer: 'A',
      analysis: 'JavaScript的基本数据类型包括：String、Number、Boolean、Null、Undefined、Symbol、BigInt。Array、Object、Function都是引用类型。',
      score: 2,
      knowledgePointIds: [jsDataTypeId]
    },
    {
      type: 'single_choice' as const,
      difficulty: 'easy' as const,
      subjectId: jsSubjectId,
      content: 'typeof null 的结果是什么？',
      options: [
        { label: 'A', content: '"null"', isCorrect: false },
        { label: 'B', content: '"undefined"', isCorrect: false },
        { label: 'C', content: '"object"', isCorrect: true },
        { label: 'D', content: '"number"', isCorrect: false }
      ],
      correctAnswer: 'C',
      analysis: '这是JavaScript的一个历史遗留bug。typeof null 返回 "object"，虽然null是基本类型。',
      score: 2,
      knowledgePointIds: [jsDataTypeId]
    },
    {
      type: 'single_choice' as const,
      difficulty: 'medium' as const,
      subjectId: jsSubjectId,
      content: '以下代码输出什么？\nconsole.log(1 + "2" + 3)',
      options: [
        { label: 'A', content: '6', isCorrect: false },
        { label: 'B', content: '"123"', isCorrect: true },
        { label: 'C', content: '"33"', isCorrect: false },
        { label: 'D', content: '15', isCorrect: false }
      ],
      correctAnswer: 'B',
      analysis: 'JavaScript中，当数字与字符串相加时，数字会被转换为字符串，然后进行拼接。1+"2"得到"12"，再加3得到"123"。',
      score: 3,
      knowledgePointIds: [jsOperatorId, jsDataTypeId]
    },
    {
      type: 'multiple_choice' as const,
      difficulty: 'medium' as const,
      subjectId: jsSubjectId,
      content: '以下哪些是JavaScript的假值（falsy values）？',
      options: [
        { label: 'A', content: '0', isCorrect: true },
        { label: 'B', content: '""', isCorrect: true },
        { label: 'C', content: 'null', isCorrect: true },
        { label: 'D', content: '"false"', isCorrect: false }
      ],
      correctAnswer: 'A,B,C',
      analysis: 'JavaScript的假值包括：false, 0, "", null, undefined, NaN。"false"是非空字符串，是真值。',
      score: 3,
      knowledgePointIds: [jsDataTypeId, jsOperatorId]
    },
    {
      type: 'true_false' as const,
      difficulty: 'easy' as const,
      subjectId: jsSubjectId,
      content: 'JavaScript是一种强类型语言。',
      options: [],
      correctAnswer: 'false',
      analysis: 'JavaScript是弱类型（动态类型）语言，变量可以随时改变类型。',
      score: 1,
      knowledgePointIds: [jsBasicId]
    },
    {
      type: 'true_false' as const,
      difficulty: 'easy' as const,
      subjectId: jsSubjectId,
      content: 'let和const声明的变量不存在变量提升。',
      options: [],
      correctAnswer: 'false',
      analysis: 'let和const声明的变量也存在变量提升，但存在暂时性死区（TDZ），在声明前访问会报错。',
      score: 1,
      knowledgePointIds: [jsBasicId]
    },
    {
      type: 'fill_blank' as const,
      difficulty: 'medium' as const,
      subjectId: jsSubjectId,
      content: '在JavaScript中，使用______关键字可以声明一个常量。',
      options: [],
      correctAnswer: 'const',
      analysis: 'const用于声明常量，声明后不能重新赋值。',
      score: 2,
      knowledgePointIds: [jsBasicId]
    },
    {
      type: 'single_choice' as const,
      difficulty: 'medium' as const,
      subjectId: jsSubjectId,
      content: '关于闭包，以下说法正确的是？',
      options: [
        { label: 'A', content: '闭包会导致内存泄漏，应该避免使用', isCorrect: false },
        { label: 'B', content: '闭包是指函数能够访问其词法作用域外部的变量', isCorrect: false },
        { label: 'C', content: '闭包是函数和其词法环境的组合', isCorrect: true },
        { label: 'D', content: '只有匿名函数才能形成闭包', isCorrect: false }
      ],
      correctAnswer: 'C',
      analysis: '闭包是函数和声明该函数的词法环境的组合。闭包本身不会导致内存泄漏，不当使用才会。',
      score: 3,
      knowledgePointIds: [jsFuncId]
    },
    {
      type: 'single_choice' as const,
      difficulty: 'hard' as const,
      subjectId: jsSubjectId,
      content: '以下代码输出顺序是？\nconsole.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);',
      options: [
        { label: 'A', content: '1, 2, 3, 4', isCorrect: false },
        { label: 'B', content: '1, 4, 2, 3', isCorrect: false },
        { label: 'C', content: '1, 4, 3, 2', isCorrect: true },
        { label: 'D', content: '1, 3, 4, 2', isCorrect: false }
      ],
      correctAnswer: 'C',
      analysis: '事件循环中，同步代码先执行（1,4），然后是微任务（Promise.then输出3），最后是宏任务（setTimeout输出2）。',
      score: 4,
      knowledgePointIds: [jsAsyncId, jsPromiseId]
    },
    {
      type: 'short_answer' as const,
      difficulty: 'hard' as const,
      subjectId: jsSubjectId,
      content: '请简述Promise的三种状态及其特点。',
      options: [],
      correctAnswer: 'pending（进行中）、fulfilled（已成功）、rejected（已失败）。状态只能从pending变为fulfilled或rejected，且一旦改变就不会再变。',
      analysis: 'Promise有三种状态：pending、fulfilled、rejected。状态转变是单向的，不可逆。',
      score: 5,
      knowledgePointIds: [jsPromiseId, jsAsyncId]
    },
    {
      type: 'single_choice' as const,
      difficulty: 'easy' as const,
      subjectId: reactSubjectId,
      content: 'React是由哪家公司开发的？',
      options: [
        { label: 'A', content: 'Google', isCorrect: false },
        { label: 'B', content: 'Facebook', isCorrect: true },
        { label: 'C', content: 'Microsoft', isCorrect: false },
        { label: 'D', content: 'Apple', isCorrect: false }
      ],
      correctAnswer: 'B',
      analysis: 'React是由Facebook（现Meta）开发并开源的前端框架。',
      score: 2,
      knowledgePointIds: [reactBasicId]
    },
    {
      type: 'single_choice' as const,
      difficulty: 'medium' as const,
      subjectId: reactSubjectId,
      content: 'React中，以下哪个Hook用于管理组件状态？',
      options: [
        { label: 'A', content: 'useEffect', isCorrect: false },
        { label: 'B', content: 'useState', isCorrect: true },
        { label: 'C', content: 'useContext', isCorrect: false },
        { label: 'D', content: 'useRef', isCorrect: false }
      ],
      correctAnswer: 'B',
      analysis: 'useState用于在函数组件中添加状态管理功能。',
      score: 3,
      knowledgePointIds: [reactHooksId]
    },
    {
      type: 'multiple_choice' as const,
      difficulty: 'medium' as const,
      subjectId: reactSubjectId,
      content: '以下关于React虚拟DOM的说法正确的有？',
      options: [
        { label: 'A', content: '虚拟DOM是真实DOM的JavaScript对象表示', isCorrect: true },
        { label: 'B', content: '虚拟DOM操作比真实DOM快', isCorrect: false },
        { label: 'C', content: 'Diff算法用于比较两棵虚拟DOM树的差异', isCorrect: true },
        { label: 'D', content: '虚拟DOM可以直接在浏览器中渲染', isCorrect: false }
      ],
      correctAnswer: 'A,C',
      analysis: '虚拟DOM是真实DOM的JS对象表示。Diff算法用于比较差异。虚拟DOM本身操作并不一定更快，它的优势在于批量更新和最小化DOM操作。',
      score: 3,
      knowledgePointIds: [reactVdomId]
    },
    {
      type: 'essay' as const,
      difficulty: 'expert' as const,
      subjectId: reactSubjectId,
      content: '请详细论述React Fiber架构的设计思想和工作原理。',
      options: [],
      correctAnswer: 'React Fiber是React 16引入的新协调引擎...（核心要点：时间切片、优先级调度、可中断渲染、双缓存机制）',
      analysis: 'Fiber架构是React的重大升级，解决了旧版本Stack Reconciler的同步渲染问题。',
      score: 10,
      knowledgePointIds: [reactVdomId, reactHooksId]
    },
    {
      type: 'true_false' as const,
      difficulty: 'easy' as const,
      subjectId: reactSubjectId,
      content: 'React组件的状态更新总是异步的。',
      options: [],
      correctAnswer: 'false',
      analysis: '在React 18之前，合成事件和生命周期中的setState是异步的，但在setTimeout等原生事件中是同步的。React 18后默认都是批量更新。',
      score: 1,
      knowledgePointIds: [reactBasicId]
    }
  ];
  
  const insertQuestion = db.prepare(`
    INSERT INTO questions (
      id, type, difficulty, subject_id, content, correct_answer,
      analysis, score, status, creator_id, hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)
  `);
  
  const insertOption = db.prepare(`
    INSERT INTO question_options (id, question_id, label, content, is_correct, sort)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertKp = db.prepare(`
    INSERT INTO question_knowledge (question_id, knowledge_point_id)
    VALUES (?, ?)
  `);
  
  for (const q of questions) {
    const hash = hashQuestion(q);
    const questionId = generateId();
    const time = now();
    
    insertQuestion.run(
      questionId, q.type, q.difficulty, q.subjectId, q.content,
      q.correctAnswer, q.analysis, q.score, teacherId, hash, time, time
    );
    
    if (q.options && q.options.length > 0) {
      q.options.forEach((opt, index) => {
        insertOption.run(
          generateId(), questionId, opt.label, opt.content,
          opt.isCorrect ? 1 : 0, index
        );
      });
    }
    
    if (q.knowledgePointIds) {
      q.knowledgePointIds.forEach(kpId => {
        insertKp.run(questionId, kpId);
      });
    }
  }
  
  console.log(`创建了 ${questions.length} 道题目`);
  console.log('种子数据初始化完成！');
  console.log('');
  console.log('测试账号：');
  console.log('  管理员: admin / admin123');
  console.log('  教师:   teacher / teacher123');
  console.log('  学生:   student / student123');
}

if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
