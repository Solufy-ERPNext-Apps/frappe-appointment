/**
 * External dependencies.
 */
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import z from "zod";
import { useFrappePostCall, useFrappeGetCall } from "frappe-react-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, ChevronLeft, CircleAlert, X } from "lucide-react";
import { formatDate } from "date-fns";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

/**
 * Internal dependencies.
 */
import { Button } from "@/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form";
import { Input } from "@/components/input";
import Typography from "@/components/typography";
import { useAppContext } from "@/context/app";
import {
  getTimeZoneOffsetFromTimeZoneString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import Spinner from "@/components/spinner";

const contactFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  guests: z.array(z.string().email("Please enter a valid email address")),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface MeetingFormProps {
  onBack: VoidFunction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (data: any) => void;
  durationId: string;
  isMobileView: boolean;
}

interface FrappeUser {
  name: string; // email is the `name` field in User doctype
  email: string;
}

const MeetingForm = ({
  onBack,
  durationId,
  onSuccess,
  isMobileView,
}: MeetingFormProps) => {
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const [guestInput, setGuestInput] = useState("");

  // Email dropdown state
  const [emailSearch, setEmailSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { call: bookMeeting, loading } = useFrappePostCall(
    `frappe_appointment.api.personal_meet.book_time_slot`
  );
  const [searchParams] = useSearchParams();
  const { selectedDate, selectedSlot, timeZone } = useAppContext();

  // Fetch matching ERPNext users based on typed email
  const { data: usersData } = useFrappeGetCall<{ message: FrappeUser[] }>(
    "frappe.client.get_list",
    emailSearch.length >= 1
      ? {
          doctype: "User",
          fields: ["name", "email"],
          filters: [
            ["enabled", "=", 1],
            ["user_type", "=", "System User"],
            ["name", "like", `%${emailSearch}%`],
          ],
          limit: 10,
        }
      : null // Don't fetch if input is empty
  );

  const suggestions: string[] =
    usersData?.message?.map((u) => u.name) ?? [];

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      guests: [],
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setDropdownIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldOnChange: (val: string) => void
  ) => {
    const val = e.target.value;
    fieldOnChange(val);
    setEmailSearch(val);
    setShowDropdown(true);
    setDropdownIndex(-1);
  };

  const handleEmailSelect = (
    email: string,
    fieldOnChange: (val: string) => void
  ) => {
    fieldOnChange(email);
    setEmailSearch(email);
    setShowDropdown(false);
    setDropdownIndex(-1);
  };

  const handleEmailKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    fieldOnChange: (val: string) => void
  ) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDropdownIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropdownIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && dropdownIndex >= 0) {
      e.preventDefault();
      handleEmailSelect(suggestions[dropdownIndex], fieldOnChange);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setDropdownIndex(-1);
    }
  };

  const handleGuestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addGuest();
    }
  };

  const addGuest = () => {
    const email = guestInput.trim();
    if (email && email.includes("@")) {
      const currentGuests = form.getValues("guests");
      if (!currentGuests.includes(email)) {
        form.setValue("guests", [...currentGuests, email]);
        setGuestInput("");
      }
    }
  };

  const removeGuest = (email: string) => {
    const currentGuests = form.getValues("guests");
    form.setValue(
      "guests",
      currentGuests.filter((guest) => guest !== email)
    );
  };

  const onSubmit = (data: ContactFormValues) => {
    const extraArgs: Record<string, string> = {};
    searchParams.forEach((value, key) => (extraArgs[key] = value));
    const meetingData = {
      ...extraArgs,
      duration_id: durationId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone)
      ),
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      user_name: data.fullName,
      user_email: data.email,
      other_participants: data.guests.join(", "),
    };

    bookMeeting(meetingData)
      .then((data) => {
        onSuccess(data);
      })
      .catch((err) => {
        const error = parseFrappeErrorMsg(err);
        toast(error || "Something went wrong", {
          duration: 4000,
          classNames: {
            actionButton:
              "group-[.toast]:!bg-red-500 group-[.toast]:hover:!bg-red-300 group-[.toast]:!text-white",
          },
          icon: <CircleAlert className="h-5 w-5 text-red-500" />,
          action: {
            label: "OK",
            onClick: () => toast.dismiss(),
          },
        });
      });
  };

  return (
    <motion.div
      key={2}
      className={`w-full md:h-[31rem] lg:w-[41rem] shrink-0 md:p-6 md:px-4`}
      initial={isMobileView ? {} : { x: "100%" }}
      animate={{ x: 0 }}
      exit={isMobileView ? {} : { x: "100%" }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 h-full flex justify-between flex-col"
        >
          <div className="space-y-4">
            <div className="flex gap-3 max-md:flex-col md:items-center md:justify-between">
              <Typography variant="p" className="text-2xl">
                Your contact info
              </Typography>
              <Typography className="text-sm  mt-1 text-blue-500 dark:text-blue-400">
                <CalendarPlus className="inline-block w-4 h-4 mr-1 md:hidden" />
                {formatDate(selectedDate, "d MMM, yyyy")}
              </Typography>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`${
                      form.formState.errors.fullName ? "text-red-500" : ""
                    }`}
                  >
                    Full Name{" "}
                    <span className="text-red-500 dark:text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      className={`active:ring-blue-400 focus-visible:ring-blue-400 ${
                        form.formState.errors.fullName
                          ? "active:ring-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                      placeholder="John Doe"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage
                    className={`${
                      form.formState.errors.fullName ? "text-red-500" : ""
                    }`}
                  />
                </FormItem>
              )}
            />

            {/* Email field with ERPNext user dropdown */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`${
                      form.formState.errors.email ? "text-red-500" : ""
                    }`}
                  >
                    Email{" "}
                    <span className="text-red-500 dark:text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        ref={inputRef}
                        disabled={loading}
                        className={`active:ring-blue-400 focus-visible:ring-blue-400 ${
                          form.formState.errors.email
                            ? "active:ring-red-500 focus-visible:ring-red-500"
                            : ""
                        }`}
                        placeholder="john.Doe@gmail.com"
                        {...field}
                        value={field.value}
                        onChange={(e) =>
                          handleEmailChange(e, field.onChange)
                        }
                        onKeyDown={(e) =>
                          handleEmailKeyDown(e, field.onChange)
                        }
                        onFocus={() => {
                          if (suggestions.length > 0) setShowDropdown(true);
                        }}
                        autoComplete="off"
                      />

                      {/* Dropdown */}
                      {showDropdown && suggestions.length > 0 && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-50 w-full mt-1 rounded-md border border-border bg-background shadow-md overflow-hidden"
                        >
                          {suggestions.map((email, idx) => (
                            <button
                              key={email}
                              type="button"
                              onMouseDown={(e) => {
                                // prevent input blur before click fires
                                e.preventDefault();
                                handleEmailSelect(email, field.onChange);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors
                                ${
                                  idx === dropdownIndex
                                    ? "bg-blue-500 text-white"
                                    : "hover:bg-blue-50 dark:hover:bg-blue-800/20 text-foreground"
                                }`}
                            >
                              {email}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage
                    className={`${
                      form.formState.errors.email ? "text-red-500" : ""
                    }`}
                  />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                className="h-auto hover:bg-blue-50 dark:hover:bg-blue-800/10 text-blue-500 dark:text-blue-400 hover:text-blue-600 "
                onClick={() => setIsGuestsOpen(!isGuestsOpen)}
                disabled={loading}
              >
                {isGuestsOpen ? "Hide Guests" : "+ Add Guests"}
              </Button>

              {isGuestsOpen && (
                <div className="space-y-2">
                  <Input
                    placeholder="janedoe@hotmail.com, bob@gmail.com, etc."
                    value={guestInput}
                    className="active:ring-blue-400 focus-visible:ring-blue-400"
                    onChange={(e) => setGuestInput(e.target.value)}
                    onKeyDown={handleGuestKeyDown}
                    onBlur={addGuest}
                    disabled={loading}
                  />
                  <div className="flex flex-wrap gap-2">
                    {form.watch("guests").map((guest) => (
                      <div
                        key={guest}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-500 dark:bg-blue-400 text-white dark:text-background rounded-full text-sm"
                      >
                        <span>{guest}</span>
                        <button
                          type="button"
                          onClick={() => removeGuest(guest)}
                          className="hover:text-blue-200"
                        >
                          <X className="h-3 w-3 dark:text-background" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between md:pt-4 max-md:h-14 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-screen max-md:border max-md:z-10 max-md:bg-background max-md:border-top max-md:items-center max-md:px-4">
            <Button
              type="button"
              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400 md:hover:bg-blue-50 md:dark:hover:bg-blue-800/10 max-md:px-0 max-md:hover:underline max-md:hover:bg-transparent"
              onClick={onBack}
              variant="ghost"
              disabled={loading}
            >
              <ChevronLeft /> Back
            </Button>
            <Button
              disabled={loading}
              className="bg-blue-500 dark:bg-blue-400 hover:bg-blue-500 dark:hover:bg-blue-400"
              type="submit"
            >
              {loading && <Spinner />} Schedule Meeting
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
};

export default MeetingForm;