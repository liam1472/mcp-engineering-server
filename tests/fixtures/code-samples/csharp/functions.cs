using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Samples
{
    /// <summary>
    /// C# function samples for testing function indexer
    /// </summary>
    public static class MathOperations
    {
        /// <summary>Calculate sum of two numbers</summary>
        public static int CalculateSum(int a, int b)
        {
            return a + b;
        }

        /// <summary>Multiply two numbers</summary>
        public static double Multiply(double x, double y)
        {
            return x * y;
        }

        /// <summary>Async method to fetch data</summary>
        public static async Task<string> FetchDataAsync(string url)
        {
            using var client = new HttpClient();
            return await client.GetStringAsync(url);
        }

        /// <summary>Generic identity method</summary>
        public static T Identity<T>(T arg)
        {
            return arg;
        }
    }

    /// <summary>User class</summary>
    public class User
    {
        public string Name { get; set; }
        public int Age { get; set; }
        public string? Email { get; set; }

        public User(string name, int age)
        {
            Name = name;
            Age = age;
        }

        public string GetDisplayName()
        {
            return $"{Name} ({Age})";
        }
    }

    /// <summary>Calculator class</summary>
    public class Calculator
    {
        private double _value;

        public Calculator(double initial = 0)
        {
            _value = initial;
        }

        public Calculator Add(double n)
        {
            _value += n;
            return this;
        }

        public Calculator Subtract(double n)
        {
            _value -= n;
            return this;
        }

        public double GetValue()
        {
            return _value;
        }

        public static Calculator Create(double initial)
        {
            return new Calculator(initial);
        }
    }

    /// <summary>Interface for data processing</summary>
    public interface IDataProcessor<T>
    {
        T Process(T data);
        bool Validate(T data);
    }
}
